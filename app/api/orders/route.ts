import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's orders including all payment statuses
    // This shows customers their order history including pending, paid, failed, and cancelled orders
    const orders = await getPrisma().order.findMany({
      where: { userId: payload.userId },
      include: {
        items: {
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
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's cart
    const cart = await getPrisma().cart.findUnique({
      where: { userId: payload.userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    // Validate stock for all items
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return NextResponse.json({
          error: `Insufficient stock for ${item.product.name}. Available: ${item.product.stock}`
        }, { status: 400 })
      }
    }

    // Calculate total
    const total = cart.items.reduce((sum: number, item: { product: { price: number }; quantity: number }) => sum + (item.product.price * item.quantity), 0)

    // Create order in a transaction
    const result = await getPrisma().$transaction(async (prisma: any) => {
      // Create order
      const order = await prisma.order.create({
        data: {
          userId: payload.userId,
          total,
          status: 'PENDING',
        },
      })

      // Create order items and update stock
      for (const item of cart.items) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
          },
        })

        // Reduce stock
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: item.product.stock - item.quantity },
        })
      }

      // Clear cart
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      })

      return order
    })

    // Record ORDER_CREATED event for NORMAL orders
    recordFulfillmentEvent(result.id, 'ORDER_CREATED', payload.userId).catch(err => {
      console.error('Failed to record order created event:', err)
    })

    return NextResponse.json({
      order: {
        id: result.id,
        total: result.total,
        status: result.status,
        createdAt: result.createdAt,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}