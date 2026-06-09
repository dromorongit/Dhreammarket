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
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or access denied' },
        { status: 404 }
      )
    }

    // Fetch fulfillment events for this order
    const events = await getPrisma().fulfillmentEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error fetching fulfillment events:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}