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

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const config = await LoyaltyEngine.tier.getLoyaltyConfig()

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Error fetching loyalty config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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