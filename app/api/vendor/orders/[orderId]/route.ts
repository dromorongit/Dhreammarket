import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { sendOrderStatusUpdateEmail } from '@/lib/email'
import { isVendorOnboarded } from '@/lib/onboarding'
import { recordFulfillmentEvent, FulfillmentEventType } from '@/lib/fulfillment-events'
import { consumeInventory } from '@/lib/stock-reservation'

export const dynamic = 'force-dynamic'

// Valid statuses that vendors can update
const VENDOR_VALID_STATUSES = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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

// Fetch the order ensuring it contains vendor's products and is paid
    const order = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        deletedAt: null, // Exclude soft-deleted orders
        paymentStatus: 'PAID', // Only paid orders
        items: {
          some: {
            productId: { in: productIds },
          },
        },
      },
      include: {
        items: {
          where: {
            productId: { in: productIds },
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        payment: true,
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

    return NextResponse.json({
      order: {
        ...order,
        vendorTotal,
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

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup to update order status' }, { status: 403 })
    }

    const orderId = params.orderId
    const body = await request.json()
    const { status, fulfillmentStatus } = body

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
        deletedAt: null, // Exclude soft-deleted orders
        paymentStatus: 'PAID',
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

    const updateData: any = {}
    
    if (status !== undefined) {
      if (!VENDOR_VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: ' + VENDOR_VALID_STATUSES.join(', ') },
          { status: 400 }
        )
      }
      updateData.status = status
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

    const updatedOrder = await getPrisma().order.update({
      where: { id: orderId },
      data: updateData,
    })

    if (isConsumptionStatus && existingOrder.orderType === 'NORMAL') {
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

    const eventMapForFulfillment: Record<string, FulfillmentEventType> = {
      READY_TO_FULFILL: 'READY_TO_FULFILL',
      PROCESSING: 'PROCESSING',
      SHIPPED: 'SHIPPED',
      DELIVERED: 'DELIVERED',
      CANCELLED: 'CANCELLED',
    }

    const eventMapForStatus: Record<string, FulfillmentEventType> = {
      PROCESSING: 'PROCESSING',
      SHIPPED: 'SHIPPED',
      DELIVERED: 'DELIVERED',
      COMPLETED: 'DELIVERED',
    }

    const eventType = fulfillmentStatus ? eventMapForFulfillment[fulfillmentStatus] : eventMapForStatus[status]
    if (eventType) {
      const orderWithItems = await getPrisma().order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
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
          select: { email: true, profile: true },
        },
      },
    })

    if (orderWithUser?.user) {
      const customerName = orderWithUser.user.profile?.firstName || orderWithUser.user.email.split('@')[0] || 'Customer'
      const statusToUpdate = status || updatedOrder.status
      sendOrderStatusUpdateEmail(orderWithUser.user.email, customerName, orderId, statusToUpdate).catch(err => {
        console.error('Failed to send order status update email:', err)
      })
    }

    return NextResponse.json({
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        fulfillmentStatus: updatedOrder.fulfillmentStatus,
        updatedAt: updatedOrder.updatedAt,
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