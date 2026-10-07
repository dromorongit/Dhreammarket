import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin, requireSuperAdmin } from '@/lib/adminAuth'
import { LoyaltyEngine } from '@/lib/loyalty/loyalty-engine'

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const tiers = await LoyaltyEngine.tier.getLoyaltyTiers()

    return NextResponse.json({ tiers })
  } catch (error) {
    console.error('Error fetching loyalty tiers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const body = await request.json()
    const { name, slug, color, minPoints, maxPoints, multiplier, pointEarningRate, cashbackRate, description, displayOrder } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    const tier = await getPrisma().loyaltyTier.create({
      data: {
        name,
        slug,
        color: color ?? '#CD7F32',
        minPoints: minPoints ?? 0,
        maxPoints: maxPoints ?? null,
        multiplier: multiplier ?? 1.0,
        pointEarningRate: pointEarningRate ?? 1.0,
        cashbackRate: cashbackRate ?? 0.0,
        description,
        displayOrder: displayOrder ?? 0,
      },
    })

    return NextResponse.json({ tier }, { status: 201 })
  } catch (error) {
    console.error('Error creating loyalty tier:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}