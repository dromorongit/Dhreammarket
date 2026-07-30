import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const vendorId = params.id
    const { badgeType } = await request.json()

    if (!badgeType) {
      return NextResponse.json({ error: 'Badge type is required' }, { status: 400 })
    }

    const validBadges = [
      'TOP_SELLER', 'TOP_SERVICE_PROVIDER', 'FAST_RESPONDER',
      'TRUSTED_VENDOR', 'PREMIUM_VENDOR', 'PLATINUM_VENDOR',
      'HIGHLY_RATED', 'VERIFIED_BUSINESS',
    ]

    if (!validBadges.includes(badgeType)) {
      return NextResponse.json({ error: 'Invalid badge type' }, { status: 400 })
    }

    const existing = await getPrisma().vendorTrustBadge.findFirst({
      where: { vendorId, badgeType },
    })

    if (existing) {
      return NextResponse.json({ error: 'Badge already awarded' }, { status: 400 })
    }

    const badge = await getPrisma().vendorTrustBadge.create({
      data: {
        vendorId,
        badgeType,
      },
    })

    return NextResponse.json({ badge }, { status: 201 })
  } catch (error) {
    console.error('Error awarding trust badge:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const vendorId = params.id

    const badges = await getPrisma().vendorTrustBadge.findMany({
      where: { vendorId, isActive: true },
      orderBy: { awardedAt: 'desc' },
    })

    return NextResponse.json({ badges })
  } catch (error) {
    console.error('Error fetching trust badges:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}