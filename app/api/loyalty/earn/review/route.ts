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
    const { hasImages, hasVideos } = body

    await LoyaltyEngine.processReviewReward(payload.userId, hasImages ?? false, hasVideos ?? false)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing review reward:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}