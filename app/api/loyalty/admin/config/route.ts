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

    const config = await LoyaltyEngine.tier.getLoyaltyConfig()

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Error fetching loyalty config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const body = await request.json()
    const { key, value, description } = body

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    const config = await LoyaltyEngine.tier.updateLoyaltyConfig(key, value, description)

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Error updating loyalty config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}