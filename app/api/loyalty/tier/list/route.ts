import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { LoyaltyEngine } from '@/lib/loyalty/loyalty-engine'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const tiers = await LoyaltyEngine.tier.getLoyaltyTiers()

    return NextResponse.json({ tiers })
  } catch (error) {
    console.error('Error fetching loyalty tiers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}