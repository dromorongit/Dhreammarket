import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { LoyaltyEngine } from '@/lib/loyalty/loyalty-engine'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const body = await request.json()
    const { orderTotal, orderId } = body

    if (!orderTotal || !orderId) {
      return NextResponse.json({ error: 'orderTotal and orderId are required' }, { status: 400 })
    }

    await LoyaltyEngine.processPurchaseReward(payload.userId, orderTotal, orderId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing purchase reward:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}