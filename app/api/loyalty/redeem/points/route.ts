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

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { amount, description, referenceId, referenceType } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    const result = await LoyaltyEngine.reward.redeemPoints({
      userId: payload.userId,
      amount,
      description,
      referenceId,
      referenceType,
    })

    return NextResponse.json({ success: true, transaction: result.transaction })
  } catch (error: any) {
    console.error('Error redeeming points:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}