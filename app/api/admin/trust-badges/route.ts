import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const badges = await getPrisma().vendorTrustBadge.findMany({
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            averageRating: true,
            reviewCount: true,
          },
        },
      },
      orderBy: { awardedAt: 'desc' },
    })

    return NextResponse.json({ badges })
  } catch (error) {
    console.error('Error fetching trust badges:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { vendorId, badgeType, expiresAt } = await request.json()

    if (!vendorId || !badgeType) {
      return NextResponse.json({ error: 'Vendor ID and badge type are required' }, { status: 400 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: vendorId },
      select: { id: true },
    })

    if (!store) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const badge = await getPrisma().vendorTrustBadge.upsert({
      where: {
        vendorId_badgeType: {
          vendorId,
          badgeType,
        },
      },
      create: {
        vendorId,
        badgeType,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      },
      update: {
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

    return NextResponse.json({ badge }, { status: 201 })
  } catch (error) {
    console.error('Error awarding trust badge:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
