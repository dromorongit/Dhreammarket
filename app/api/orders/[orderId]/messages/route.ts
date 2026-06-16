import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createNotification } from '@/lib/notifications'

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
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = params.orderId
    const userRole = payload.role

    // Fetch messages ensuring user has access to the order
    const order = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        items: {
          select: {
            product: {
              select: {
                storeId: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify access: customer owns the order, or vendor has products in it
    const storeIds = order.items.map(item => item.product.storeId)
    const isCustomer = order.userId === payload.userId
    const isVendor = userRole === 'VENDOR' && storeIds.length > 0
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'

    if (!isCustomer && !isVendor && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Fetch messages
    const messages = await getPrisma().orderMessage.findMany({
      where: { orderId },
      include: {
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
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error fetching order messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = params.orderId
    const { message, messageType = 'GENERAL' } = await request.json()

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    // Verify order exists and user has access (mirroring GET logic)
    const order = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        items: {
          select: {
            product: {
              select: {
                storeId: true,
                store: {
                  select: {
                    userId: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const storeIds = order.items.map(item => item.product.storeId)
    const vendorId = order.items[0]?.product?.store?.userId
    const isCustomer = order.userId === payload.userId
    const isVendor = payload.role === 'VENDOR' && storeIds.some(id => order.items.some(i => i.product.storeId === id))
    const isAdmin = payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN'

    if (!isCustomer && !isVendor && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Create the message
    const newMessage = await getPrisma().orderMessage.create({
      data: {
        orderId,
        userId: payload.userId,
        userRole: payload.role,
        message: message.trim(),
        messageType,
      },
      include: {
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
    })

    // Send notification to the other party
    if (isCustomer && vendorId) {
      await createNotification(
        vendorId,
        'SUPPORT_TICKET_CREATED',
        'New Order Message',
        `You have a new message about order #${orderId.slice(-8).toUpperCase()}`
      )
    } else if (isVendor) {
      await createNotification(
        order.userId,
        'SUPPORT_TICKET_CREATED',
        'Vendor Response',
        `A vendor has responded to your order #${orderId.slice(-8).toUpperCase()}`
      )
    }

    return NextResponse.json({ message: newMessage }, { status: 201 })
  } catch (error) {
    console.error('Error creating order message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}