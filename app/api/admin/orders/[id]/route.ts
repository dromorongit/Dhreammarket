import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { releaseStock, consumeInventory, restoreManualSaleStock } from '@/lib/stock-reservation'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'
import { stampOrderItems } from '@/lib/order-delivery-stamps'
import { isManualOrder } from '@/lib/order-source'

const prisma = getPrisma()

export const dynamic = 'force-dynamic'

// GET single order with complete details
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const orderId = params.id

    const order = await prisma.order.findUnique({
      where: { id: orderId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        items: {
          include: {
            product: {
              include: {
                store: {
                  select: {
                    id: true,
                    name: true,
                    mainPhoneNumber: true,
                  },
                },
                images: {
                  select: {
                    url: true,
                  },
                  take: 1,
                },
              },
            },
            productVariant: true,
          },
        },
        payment: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Extract customer name with fallback hierarchy
    const customerName = order.user
      ? [order.user.profile?.firstName, order.user.profile?.lastName].filter(Boolean).join(' ') || order.user.email
      : order.customerFirstName || order.customerEmail || 'Customer'

    // Group items by store for easier display
    const itemsByStore = order.items.reduce((acc, item) => {
      const storeName = item.product?.store?.name || 'Unknown Store'
      if (!acc[storeName]) {
        acc[storeName] = {
          storeName,
          vendorContact: item.product?.store?.mainPhoneNumber || null,
          items: [],
        }
      }
      acc[storeName].items.push({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        color: item.color,
        size: item.size,
        age: item.age,
        productName: item.product?.name || 'Unknown Product',
        productImage: item.product?.images?.[0]?.url || null,
      })
      return acc
    }, {} as Record<string, { storeName: string; vendorContact: string | null; items: any[] }>)

    const storeGroups = Object.values(itemsByStore)

    return NextResponse.json({
      order: {
        id: order.id,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
        orderType: order.orderType,
        fulfillmentStatus: order.fulfillmentStatus,
        vendorAccepted: order.vendorAccepted,
        vendorRejected: order.vendorRejected,
        vendorRejectionReason: order.vendorRejectionReason,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        customerName,
        customerEmail: order.user?.email || order.customerEmail || null,
        customerPhone: order.user?.profile?.phone || order.customerPhone || null,
        customerAddress: order.customerAddress,
        customerCity: order.customerCity,
        customerRegion: order.customerRegion,
        storeGroups,
        payment: order.payment ? {
          id: order.payment.id,
          amount: order.payment.amount,
          status: order.payment.status,
          reference: order.payment.reference,
          paystackRef: order.payment.paystackRef,
          createdAt: order.payment.createdAt.toISOString(),
        } : null,
      },
    })
  } catch (error) {
    console.error('Admin order detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch order details' }, { status: 500 })
  }
}

// PATCH - Update order status (e.g., cancel order)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const adminUser = authCheck
    const orderId = params.id
    const body = await request.json()
    const { status, paymentStatus, reason } = body

    // Refunds are a money-moving operation with a Paystack call, a per-item
    // cap and an audit trail, so they live in POST /api/admin/refunds.
    if (paymentStatus === 'REFUNDED') {
      return NextResponse.json(
        {
          error:
            "Use POST /api/admin/refunds to refund this order. That endpoint issues the Paystack refund, enforces the per-item refund cap and records the refund for audit.",
          endpoint: 'POST /api/admin/refunds',
          orderId,
        },
        { status: 400 }
      )
    }

    // Get existing order for before data
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId, deletedAt: null },
      select: { orderType: true, status: true, paymentStatus: true, source: true },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const updateData: any = {}

    if (status && ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      updateData.status = status
      if (status === 'CANCELLED') {
        recordFulfillmentEvent(orderId, 'CANCELLED', undefined, {
          description: reason || 'Order cancelled by administrator',
        }).catch(err => console.error('Failed to record cancellation event:', err))
      }
    }

    if (paymentStatus && ['PENDING', 'PAID', 'FAILED', 'CANCELLED'].includes(paymentStatus)) {
      updateData.paymentStatus = paymentStatus
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Determine what to stamp based on the values actually written
    const newStatus = updateData.status ?? existingOrder.status
    const statusChanged = updateData.status !== undefined && updateData.status !== existingOrder.status

    const now = new Date()
    let updatedOrder: typeof existingOrder & { id: string }

    await prisma.$transaction(async (tx) => {
      // Check if this is a single-store order (all items belong to the same store)
      const itemsWithStores = await tx.orderItem.findMany({
        where: { orderId },
        select: { product: { select: { storeId: true } } },
      })
      const storeIds = Array.from(new Set(itemsWithStores.map(i => i.product.storeId).filter(Boolean)))
      const isSingleStore = storeIds.length === 1
      const storeId = isSingleStore ? storeIds[0] : null

      updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updateData,
      })

      // Admin can stamp shippedAt/deliveredAt for single-store orders
      if (isSingleStore && storeId) {
        // Stamp shippedAt when transitioning to SHIPPED
        if (statusChanged && newStatus === 'SHIPPED') {
          await stampOrderItems({ orderId, storeId, field: 'shippedAt', now, tx })
        }

        // Stamp deliveredAt (and shippedAt if still null) when transitioning to DELIVERED
        if (statusChanged && newStatus === 'DELIVERED') {
          await stampOrderItems({ orderId, storeId, field: 'deliveredAt', now, tx })
        }
        // COMPLETED alone stamps nothing
      }
    })

    // Create audit log for order cancellation
    if (status === 'CANCELLED') {
      // Manual order cancellation: restore consumed stock atomically.
      if (isManualOrder(existingOrder)) {
        try {
          await getPrisma().$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`
            const restoreResult = await restoreManualSaleStock(tx, orderId)
            if (!restoreResult.success) {
              throw new Error(restoreResult.error || 'Failed to restore stock')
            }
          })
        } catch (restoreErr) {
          console.error('Failed to restore stock for cancelled manual order:', restoreErr)
        }
      }

      await createAuditLog({
        userId: adminUser.userId,
        userRole: adminUser.role,
        action: 'ORDER_CANCELLED',
        entityType: 'ORDER',
        entityId: orderId,
        beforeData: { status: existingOrder.status },
        afterData: { status: updatedOrder!.status, reason },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
      })
    }

    if ((status === 'DELIVERED' || status === 'COMPLETED') && existingOrder.orderType === 'NORMAL') {
      const consumptionResult = await consumeInventory(orderId)
      if (!consumptionResult.success && consumptionResult.error) {
        console.error('Inventory consumption failed:', consumptionResult.error)
      } else if (consumptionResult.consumedItems && consumptionResult.consumedItems.length > 0) {
        for (const item of consumptionResult.consumedItems) {
          recordFulfillmentEvent(orderId, 'INVENTORY_CONSUMED', undefined, {
            productName: item.productId,
            description: `Consumed ${item.quantity} units of inventory.`,
          }).catch(err => console.error('Failed to record inventory consumed event:', err))
        }
      }
    }

    // Release stock for cancelled/refunded NORMAL orders
    if ((status === 'CANCELLED' || paymentStatus === 'REFUNDED') && existingOrder.orderType === 'NORMAL') {
      releaseStock(orderId).catch(err => {
        console.error('Failed to release stock:', err)
      })
    }

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder!.id,
        status: updatedOrder!.status,
        paymentStatus: updatedOrder!.paymentStatus,
      },
    })
  } catch (error) {
    console.error('Admin order update error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}