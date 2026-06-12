import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

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