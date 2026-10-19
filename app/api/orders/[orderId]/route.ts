import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import {
  PUBLIC_ORDER_ITEM_SELECT,
  PUBLIC_ORDER_SELECT,
  PUBLIC_VARIANT_SELECT,
} from '@/lib/public-selects'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const payload = outcome

    const orderId = params.orderId

    // Fetch order ensuring it belongs to the current user
    const order = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        userId: payload.userId,
        deletedAt: null, // Exclude soft-deleted orders
      },
      select: {
        ...PUBLIC_ORDER_SELECT,
        items: {
          select: {
            ...PUBLIC_ORDER_ITEM_SELECT,
            product: {
              select: {
                id: true,
                name: true,
                storeId: true,
                images: {
                  where: { mediaType: 'image' },
                  orderBy: { createdAt: 'asc' },
                  select: { url: true },
                  take: 1,
                },
                store: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            productVariant: { select: PUBLIC_VARIANT_SELECT },
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

    // Include delivery timestamps for customer's own items only
    const itemsWithDelivery = order.items.map(item => ({
      ...item,
      deliveredAt: item.deliveredAt,
      deliveryConfirmedAt: item.deliveryConfirmedAt,
    }))

    return NextResponse.json({
      order: {
        ...order,
        items: itemsWithDelivery,
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