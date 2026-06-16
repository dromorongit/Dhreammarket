import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

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

    // Fetch order ensuring it belongs to the current user
    const order = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        userId: payload.userId,
        deletedAt: null, // Exclude soft-deleted orders
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                storeId: true,
                store: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            productVariant: true,
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

    return NextResponse.json({
      order: {
        ...order,
        vendorAccepted: order.vendorAccepted,
        vendorRejected: order.vendorRejected,
        vendorRejectionReason: order.vendorRejectionReason,
      },
    })
  } catch (error) {
    console.error('Error fetching customer order detail:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}