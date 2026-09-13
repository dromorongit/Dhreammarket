import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
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

    const url = new URL(request.url)
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 50)
    const skip = (page - 1) * limit

    const whereClause: any = {
      userId: payload.userId,
      deletedAt: null,
    }

    const total = await getPrisma().order.count({ where: whereClause })

    const orders = await getPrisma().order.findMany({
      where: whereClause,
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
      skip,
      take: limit,
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      orders: orders.map(order => ({
        ...order,
        vendorAccepted: order.vendorAccepted,
        vendorRejected: order.vendorRejected,
      })),
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DEPRECATED: This endpoint is no longer used for order creation.
// Order creation has been migrated to /api/checkout which handles:
// - Payment processing (Paystack integration)
// - Stock reservation and allocation
// - Order fulfillment workflow
// - Proper transaction handling
// All order creation requests must go through /api/checkout instead.
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { message: 'Deprecated endpoint. Use /api/checkout instead.' },
    { status: 410 }
  )
}