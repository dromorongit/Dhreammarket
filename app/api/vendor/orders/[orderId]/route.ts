import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { sendOrderStatusUpdateEmail } from '@/lib/email'
import { canSendCustomerEmail } from '@/lib/notification-preferences'
import { isVendorOnboarded } from '@/lib/onboarding'
import { recordFulfillmentEvent, FulfillmentEventType } from '@/lib/fulfillment-events'
import { consumeInventory, releaseStock, restoreManualSaleStock } from '@/lib/stock-reservation'
import { createNotification } from '@/lib/notifications'
import { creditInfluencerOrderCashback, reverseInfluencerOrderCashback } from '@/lib/influencer/order-cashback'
import { createAuditLog } from '@/lib/audit-log'
import { notifySuperAdminsRefundRequested } from '@/lib/refunds/admin-notify'
import { stampOrderItems } from '@/lib/order-delivery-stamps'
import { isManualOrder } from '@/lib/order-source'
import {
  VENDOR_ORDER_ITEM_SELECT,
  VENDOR_ORDER_SELECT,
} from '@/lib/public-selects'

export const dynamic = 'force-dynamic'

// Valid statuses that vendors can update
const VENDOR_VALID_STATUSES = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']

// Valid acceptance/rejection actions
const VENDOR_ACCEPTANCE_ACTIONS = ['accept', 'reject']

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    // Check if vendor has completed onboarding (store and category)
    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup to view order details' }, { status: 403 })
    }

    const orderId = params.orderId

    // Get vendor's store to verify ownership
    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
      include: {
        products: {
          select: { id: true },
        },
      },
    })

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    const productIds = store.products.map((p: { id: string }) => p.id)

    // Fetch the order ensuring it contains vendor's products and is paid or manual
    const order = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        deletedAt: null, // Exclude soft-deleted orders
        OR: [
          { paymentStatus: 'PAID' },
          { source: 'MANUAL' },
        ],
        items: {
          some: {
            productId: { in: productIds },
          },
        },
      },
      select: {
        ...VENDOR_ORDER_SELECT,
        // The vendor's own rider cost. It is only shown when the order is
        // theirs alone: on a shared order it belongs to another vendor.
        deliveryCost: true,
        items: {
          where: {
            productId: { in: productIds },
          },
          select: {
            ...VENDOR_ORDER_ITEM_SELECT,
            product: {
              select: {
                id: true,
                name: true,
                storeId: true,
              },
            },
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            reference: true,
            paystackRef: true,
            message: true,
            createdAt: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                address: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or access denied' },
        { status: 404 }
      )
    }

    // Calculate vendor-specific totals (only their products)
    const vendorTotal = order.items.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
      0
    )

    const otherVendorItemCount = await getPrisma().orderItem.count({
      where: {
        orderId: orderId,
        productId: { notIn: productIds },
      },
    })

    const hasOtherVendorItems = otherVendorItemCount > 0

    // The delivery cost of a shared order belongs to whoever delivered it,
    // so it is only shown when the order holds this vendor's lines only.
    const { deliveryCost, ...orderWithoutDeliveryCost } = order

    return NextResponse.json({
      order: {
        ...orderWithoutDeliveryCost,
        deliveryCost:
          hasOtherVendorItems || order.source !== 'MANUAL'
            ? null
            : (deliveryCost ?? null),
        vendorTotal,
        hasOtherVendorItems,
        vendorAccepted: order.vendorAccepted,
        vendorRejected: order.vendorRejected,
        vendorRejectionReason: order.vendorRejectionReason,
      },
    })
  } catch (error) {
    console.error('Error fetching vendor order detail:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup to update order status' }, { status: 403 })
    }

    const orderId = params.orderId
    const body = await request.json()
    const { status, fulfillmentStatus, action, rejectionReason } = body

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
      include: {
        products: {
          select: { id: true },
        },
      },
    })

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      )
    }

    const productIds = store.products.map((p: { id: string }) => p.id)

    const existingOrder = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        deletedAt: null,
        OR: [
          { paymentStatus: 'PAID' },
          { source: 'MANUAL' },
        ],
        items: {
          some: {
            productId: { in: productIds },
          },
        },
      },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found or access denied' },
        { status: 404 }
      )
    }

    const manual = isManualOrder(existingOrder)

    const updateData: any = {}

    // Handle acceptance/rejection action
    if (action !== undefined) {
      if (!VENDOR_ACCEPTANCE_ACTIONS.includes(action)) {
        return NextResponse.json(
          { error: 'Invalid action. Must be one of: ' + VENDOR_ACCEPTANCE_ACTIONS.join(', ') },
          { status: 400 }
        )
      }

      if (action === 'accept') {
        if (existingOrder.vendorAccepted) {
          return NextResponse.json(
            { error: 'Order already accepted' },
            { status: 400 }
          )
        }
        updateData.vendorAccepted = true
        updateData.vendorRejected = false
        updateData.vendorRejectionReason = null
      } else if (action === 'reject') {
        if (existingOrder.vendorRejected) {
          return NextResponse.json(
            { error: 'Order already rejected' },
            { status: 400 }
          )
        }
        if (!rejectionReason || rejectionReason.trim().length === 0) {
          return NextResponse.json(
            { error: 'Rejection reason is required' },
            { status: 400 }
          )
        }
        if (!manual) {
          updateData.vendorAccepted = false
          updateData.vendorRejected = true
          updateData.vendorRejectionReason = rejectionReason.trim()
        }
        updateData.status = 'CANCELLED'
        updateData.fulfillmentStatus = 'CANCELLED'

        let updatedOrder: typeof existingOrder | null = null

        if (manual) {
          // Manual cancellation is atomic: lock the order row, restore stock,
          // and set status CANCELLED in a single transaction.
          try {
            updatedOrder = await getPrisma().$transaction(async (tx) => {
              // Lock the order row to prevent concurrent cancels.
              await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`
              const restoreResult = await restoreManualSaleStock(tx, orderId)
              if (!restoreResult.success) {
                throw new Error(restoreResult.error || 'Failed to restore stock')
              }
              return tx.order.update({
                where: { id: orderId },
                data: updateData,
              })
            })
          } catch (err) {
            return NextResponse.json(
              { error: `Failed to cancel manual order: ${err instanceof Error ? err.message : 'Unknown error'}` },
              { status: 500 }
            )
          }
        } else if (existingOrder.orderType === 'NORMAL') {
          const stockReleaseResult = await releaseStock(orderId, payload.userId, productIds)
          if (!stockReleaseResult.success) {
            return NextResponse.json(
              { error: `Failed to release stock for rejected order: ${stockReleaseResult.error}` },
              { status: 500 }
            )
          }
          updatedOrder = await getPrisma().order.update({
            where: { id: orderId },
            data: updateData,
          })
        } else {
          updatedOrder = await getPrisma().order.update({
            where: { id: orderId },
            data: updateData,
          })
        }

        const refundRequested = existingOrder.paymentStatus === 'PAID' && !manual

        if (!manual) {
          try {
            await reverseInfluencerOrderCashback(orderId)
          } catch (reverseErr) {
            console.error('Failed to reverse influencer cashback on rejection:', reverseErr)
          }

          if (refundRequested) {
            recordFulfillmentEvent(orderId, 'REFUND_REQUESTED', payload.userId).catch(
              err => console.error('Failed to record refund request event:', err)
            )
            createAuditLog({
              userId: payload.userId,
              userRole: payload.role,
              action: 'ORDER_REFUND_REQUESTED',
              entityType: 'ORDER',
              entityId: orderId,
              afterData: {
                source: 'VENDOR_REJECTION',
                paymentStatus: existingOrder.paymentStatus,
                total: existingOrder.total,
                walletAssisted: (existingOrder.walletAmountApplied ?? 0) > 0,
              },
            }).catch(err => console.error('Failed to create refund request audit log:', err))

            notifySuperAdminsRefundRequested({
              orderId,
              total: existingOrder.total,
              storeName: store.name,
              source: 'VENDOR_REJECTION',
            }).catch(err => console.error('Failed to notify super admins:', err))
          }
        }

        recordFulfillmentEvent(orderId, 'CANCELLED', payload.userId, {
          description: rejectionReason.trim() || 'Order rejected by vendor',
        }).catch(err => console.error('Failed to record rejection event:', err))

        await createAuditLog({
          userId: payload.userId,
          userRole: payload.role,
          action: 'ORDER_CANCELLED',
          entityType: 'ORDER',
          entityId: orderId,
          beforeData: {
            status: existingOrder.status,
            paymentStatus: existingOrder.paymentStatus,
          },
          afterData: {
            status: 'CANCELLED',
            ...(!manual && { vendorRejected: true, vendorRejectionReason: rejectionReason.trim() }),
            paymentStatus: existingOrder.paymentStatus,
          },
        }).catch(err => console.error('Failed to create rejection audit log:', err))

        const orderWithUser = await getPrisma().order.findUnique({
          where: { id: orderId },
          include: {
            user: {
              select: { id: true, email: true, profile: true },
            },
          },
        })

        if (orderWithUser?.user) {
          const customerName = orderWithUser.user.profile?.firstName || orderWithUser.user.email.split('@')[0] || 'Customer'
          createNotification(
            orderWithUser.user.id,
            'ORDER_STATUS_UPDATED',
            'Order Rejected by Vendor',
            `Your order #${orderId.slice(-8).toUpperCase()} was rejected by the vendor.${refundRequested ? ' A refund has been requested and is pending review.' : ''}`
          ).catch(err => console.error('Failed to create rejection notification:', err))

          if (await canSendCustomerEmail(orderWithUser.user.id)) {
            sendOrderStatusUpdateEmail(orderWithUser.user.email, customerName, orderId, 'CANCELLED').catch(err => {
              console.error('Failed to send rejection email:', err)
            })
          }
        }

        return NextResponse.json({
          order: {
            id: updatedOrder.id,
            status: updatedOrder.status,
            fulfillmentStatus: updatedOrder.fulfillmentStatus,
            vendorAccepted: updatedOrder.vendorAccepted,
            vendorRejected: updatedOrder.vendorRejected,
            vendorRejectionReason: updatedOrder.vendorRejectionReason,
            updatedAt: updatedOrder.updatedAt,
          },
        })
      }
    }

    if (status !== undefined) {
      if (!VENDOR_VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: ' + VENDOR_VALID_STATUSES.join(', ') },
          { status: 400 }
        )
      }
      // Prevent status updates if order is rejected
      if (existingOrder.vendorRejected) {
        return NextResponse.json(
          { error: 'Cannot update status for a rejected order' },
          { status: 400 }
        )
      }
      const validStatusTransitions: Record<string, string[]> = {
        PENDING: ['PROCESSING'],
        PROCESSING: ['SHIPPED'],
        SHIPPED: ['DELIVERED'],
        DELIVERED: ['COMPLETED'],
      }
      const allowedNextStatuses = validStatusTransitions[existingOrder.status]
      if (!allowedNextStatuses || !allowedNextStatuses.includes(status)) {
        return NextResponse.json(
          {
            error: `Cannot move from ${existingOrder.status} to ${status} — orders must progress through ${allowedNextStatuses?.join(' and ') || 'valid steps'} first.`,
          },
          { status: 400 }
        )
      }
      updateData.status = status
    }

    if (fulfillmentStatus !== undefined) {
      // Prevent fulfillment status updates if order is rejected
      if (existingOrder.vendorRejected) {
        return NextResponse.json(
          { error: 'Cannot update fulfillment status for a rejected order' },
          { status: 400 }
        )
      }
    }

    const isConsumptionStatus = fulfillmentStatus === 'DELIVERED' || fulfillmentStatus === 'COMPLETED' || status === 'DELIVERED' || status === 'COMPLETED'

    if (fulfillmentStatus !== undefined) {
      const validTransitions: Record<string, string[]> = {
        AWAITING_STOCK: ['READY_TO_FULFILL'],
        AWAITING_RESTOCK: ['READY_TO_FULFILL'],
        READY_TO_FULFILL: ['PROCESSING'],
        PROCESSING: ['SHIPPED'],
        SHIPPED: ['DELIVERED'],
        DELIVERED: ['COMPLETED'],
      }

      if (!validTransitions[existingOrder.fulfillmentStatus]?.includes(fulfillmentStatus)) {
        return NextResponse.json(
          { error: `Invalid fulfillment status transition. From ${existingOrder.fulfillmentStatus}, can only transition to: ${validTransitions[existingOrder.fulfillmentStatus]?.join(', ') || 'none'}` },
          { status: 400 }
        )
      }
      updateData.fulfillmentStatus = fulfillmentStatus
    }

    const prisma = getPrisma()
    const now = new Date()
    const storeId = store.id

    // Determine what to stamp based on the values actually written
    const newStatus = updateData.status ?? existingOrder.status
    const newFulfillmentStatus = updateData.fulfillmentStatus ?? existingOrder.fulfillmentStatus
    const statusChanged = updateData.status !== undefined && updateData.status !== existingOrder.status
    const fulfillmentStatusChanged = updateData.fulfillmentStatus !== undefined && updateData.fulfillmentStatus !== existingOrder.fulfillmentStatus

    let updatedOrder: typeof existingOrder

    await prisma.$transaction(async (tx) => {
      updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updateData,
      })

      // Stamp shippedAt when transitioning to SHIPPED via either path
      if ((statusChanged && newStatus === 'SHIPPED') || (fulfillmentStatusChanged && newFulfillmentStatus === 'SHIPPED')) {
        await stampOrderItems({ orderId, storeId, field: 'shippedAt', now, tx })
      }

      // Stamp deliveredAt (and shippedAt if still null) when transitioning to DELIVERED via either path
      if ((statusChanged && newStatus === 'DELIVERED') || (fulfillmentStatusChanged && newFulfillmentStatus === 'DELIVERED')) {
        await stampOrderItems({ orderId, storeId, field: 'deliveredAt', now, tx })
      }
      // COMPLETED alone stamps nothing (but may have already stamped deliveredAt via transition)
    })

    if (isConsumptionStatus && existingOrder.orderType === 'NORMAL' && !manual) {
      const consumptionResult = await consumeInventory(orderId, payload.userId)
      if (!consumptionResult.success && consumptionResult.error) {
        console.error('Inventory consumption failed:', consumptionResult.error)
      } else if (consumptionResult.consumedItems && consumptionResult.consumedItems.length > 0) {
        for (const item of consumptionResult.consumedItems) {
          recordFulfillmentEvent(orderId, 'INVENTORY_CONSUMED', payload.userId, {
            productName: item.productId,
            description: `Consumed ${item.quantity} units of inventory.`,
          }).catch(err => console.error('Failed to record inventory consumed event:', err))
        }
      }
    }

    if (isConsumptionStatus && existingOrder.paymentStatus === 'PAID' && !manual) {
      try {
        const orderForCashback = await getPrisma().order.findUnique({
          where: { id: orderId },
          select: { subtotal: true, userId: true, user: { select: { id: true, influencerAttributionCode: true } } },
        })
        if (orderForCashback?.user?.influencerAttributionCode && orderForCashback.subtotal && orderForCashback.subtotal > 0) {
          await creditInfluencerOrderCashback(
            orderForCashback.user.id,
            orderId,
            orderForCashback.user.influencerAttributionCode,
            orderForCashback.subtotal
          )
        }
      } catch (cashbackErr) {
        console.error('Failed to credit influencer cashback:', cashbackErr)
      }
    }

    const eventMapForFulfillment: Record<string, FulfillmentEventType> = {
      READY_TO_FULFILL: 'READY_TO_FULFILL',
      PROCESSING: 'PROCESSING',
      SHIPPED: 'SHIPPED',
      DELIVERED: 'DELIVERED',
      COMPLETED: 'DELIVERED',
    }

    const eventMapForStatus: Record<string, FulfillmentEventType> = {
      PROCESSING: 'PROCESSING',
      SHIPPED: 'SHIPPED',
      DELIVERED: 'DELIVERED',
      COMPLETED: 'COMPLETED',
    }

    const eventType = fulfillmentStatus ? eventMapForFulfillment[fulfillmentStatus] : eventMapForStatus[status]
    if (eventType) {
      const orderWithItems = await getPrisma().order.findUnique({
        where: { id: orderId },
        // Only the name of one of the vendor's own products is needed. An
        // `include` would read the cost price of every product of the
        // order, including the ones of the other vendors.
        select: {
          items: {
            where: { productId: { in: productIds } },
            take: 1,
            select: { product: { select: { name: true } } },
          },
        },
      })
      const item = orderWithItems?.items?.[0]
      recordFulfillmentEvent(orderId, eventType, payload.userId, {
        productName: item?.product?.name,
      }).catch(err => console.error('Failed to record fulfillment event:', err))
    }

    const orderWithUser = await getPrisma().order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, email: true, profile: true },
        },
      },
    })

    if (orderWithUser?.user) {
      const customerName = orderWithUser.user.profile?.firstName || orderWithUser.user.email.split('@')[0] || 'Customer'
      const statusToUpdate = status || updatedOrder!.status
      if (await canSendCustomerEmail(orderWithUser.user.id)) {
        sendOrderStatusUpdateEmail(orderWithUser.user.email, customerName, orderId, statusToUpdate).catch(err => {
          console.error('Failed to send order status update email:', err)
        })
      }
    }

    if (action === 'reject') {
      if (orderWithUser?.user) {
        const customerName = orderWithUser.user.profile?.firstName || orderWithUser.user.email.split('@')[0] || 'Customer'
        createNotification(
          orderWithUser.user.id,
          'ORDER_STATUS_UPDATED',
          'Order Rejected by Vendor',
          `Your order #${orderId.slice(-8).toUpperCase()} was rejected by the vendor.${existingOrder.paymentStatus === 'PAID' ? ' A refund has been requested and is pending review.' : ''}`
        ).catch(err => console.error('Failed to create rejection notification:', err))

        if (await canSendCustomerEmail(orderWithUser.user.id)) {
          sendOrderStatusUpdateEmail(orderWithUser.user.email, customerName, orderId, 'CANCELLED').catch(err => {
            console.error('Failed to send rejection email:', err)
          })
        }
      }
    }

    return NextResponse.json({
      order: {
        id: updatedOrder!.id,
        status: updatedOrder!.status,
        fulfillmentStatus: updatedOrder!.fulfillmentStatus,
        vendorAccepted: updatedOrder!.vendorAccepted,
        vendorRejected: updatedOrder!.vendorRejected,
        vendorRejectionReason: updatedOrder!.vendorRejectionReason,
        updatedAt: updatedOrder!.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error updating vendor order status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
