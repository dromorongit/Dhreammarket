import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

// Valid fulfillment status transitions for vendors
const VALID_FULFILLMENT_TRANSITIONS: Record<string, string[]> = {
  AWAITING_STOCK: ['READY_TO_FULFILL'],
  AWAITING_RESTOCK: ['READY_TO_FULFILL'],
  READY_TO_FULFILL: ['PROCESSING'],
  PROCESSING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
}

// Get only the next valid status for display
const getNext_FULFILLMENT_STATUS = (currentStatus: string): string | null => {
  return VALID_FULFILLMENT_TRANSITIONS[currentStatus]?.[0] || null
}

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ 
        orders: [], 
        error: 'Complete store setup to view fulfillment orders' 
      }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
      include: {
        products: {
          select: { id: true },
        },
      },
    })

    if (!store) {
      return NextResponse.json({ orders: [] })
    }

    const productIds = store.products?.map((p) => p.id) || []
    if (productIds.length === 0) {
      return NextResponse.json({ orders: [] })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const filter = searchParams.get('filter') || 'all' // all, preorder, backorder

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      paymentStatus: 'PAID',
      orderType: { in: ['PREORDER', 'BACKORDER'] },
      items: {
        some: {
          productId: { in: productIds },
        },
      },
    }

    if (filter === 'preorder') {
      where.orderType = 'PREORDER'
    } else if (filter === 'backorder') {
      where.orderType = 'BACKORDER'
    }

    const orders = await getPrisma().order.findMany({
      where,
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
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    })

    const ordersWithDetails = orders.map((order) => {
      const item = order.items[0] || { product: { name: 'Unknown' } }
      const expectedDate = order.orderType === 'PREORDER'
        ? item.expectedArrivalDate
        : item.expectedRestockDate

      return {
        id: order.id,
        orderNumber: order.id.slice(-8).toUpperCase(),
        customer: order.user.profile?.firstName
          ? `${order.user.profile.firstName} ${order.user.profile.lastName || ''}`.trim()
          : order.user.email.split('@')[0],
        customerEmail: order.user.email,
        product: item.product.name,
        orderType: order.orderType,
        fulfillmentStatus: order.fulfillmentStatus,
        nextStatus: getNext_FULFILLMENT_STATUS(order.fulfillmentStatus),
        expectedDate: expectedDate ? new Date(expectedDate).toLocaleDateString() : null,
        createdAt: order.createdAt,
        daysOutstanding: Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      }
    })

    const total = await getPrisma().order.count({ where })

    return NextResponse.json({
      orders: ordersWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching fulfillment orders:', error)
    return NextResponse.json(
      { error: 'Internal server error', orders: [] },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
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
      return NextResponse.json(
        { error: 'Complete store setup to update fulfillment status' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { orderId, fulfillmentStatus } = body

    if (!orderId || !fulfillmentStatus) {
      return NextResponse.json(
        { error: 'Order ID and fulfillment status are required' },
        { status: 400 }
      )
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
      include: {
        products: { select: { id: true } },
      },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const productIds = store.products?.map((p) => p.id) || []

    const existingOrder = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        paymentStatus: 'PAID',
        orderType: { in: ['PREORDER', 'BACKORDER'] },
        items: {
          some: {
            productId: { in: productIds },
          },
        },
      },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found or not a pre-order/backorder' },
        { status: 404 }
      )
    }

    const validTransitions = VALID_FULFILLMENT_TRANSITIONS[existingOrder.fulfillmentStatus] || []
    if (!validTransitions.includes(fulfillmentStatus)) {
      return NextResponse.json(
        { error: `Invalid status transition. From ${existingOrder.fulfillmentStatus}, can only transition to: ${validTransitions.join(', ')}` },
        { status: 400 }
      )
    }

    const updatedOrder = await getPrisma().order.update({
      where: { id: orderId },
      data: { fulfillmentStatus },
    })

    return NextResponse.json({
      order: {
        id: updatedOrder.id,
        fulfillmentStatus: updatedOrder.fulfillmentStatus,
      },
    })
  } catch (error) {
    console.error('Error updating fulfillment status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}