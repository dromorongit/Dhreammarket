import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { sendOrderStatusUpdateEmail } from '@/lib/email'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

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

    // Check if vendor has completed onboarding (store and category)
    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup to update order status' }, { status: 403 })
    }

    const orderId = params.orderId
    const body = await request.json()
    const { status } = body

    // Validate status
    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') },
        { status: 400 }
      )
    }

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

    // Verify the order contains vendor's products and is paid
    const existingOrder = await getPrisma().order.findFirst({
      where: {
        id: orderId,
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

    // Update the order status
    const updatedOrder = await getPrisma().order.update({
      where: { id: orderId },
      data: { status },
    })

    // Get customer info for email notification
    const orderWithUser = await getPrisma().order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { email: true, profile: true },
        },
      },
    })

    // Send status update email (non-blocking)
    if (orderWithUser?.user) {
      const customerName = orderWithUser.user.profile?.firstName || orderWithUser.user.email.split('@')[0] || 'Customer'
      sendOrderStatusUpdateEmail(orderWithUser.user.email, customerName, orderId, status).catch(err => {
        console.error('Failed to send order status update email:', err)
      })
    }

    return NextResponse.json({
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
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