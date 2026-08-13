import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { HomepageSectionType } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface TrendingSettings {
  contentSource: 'AUTOMATIC' | 'MANUAL' | 'HYBRID'
  maxProducts: number
  weights?: {
    recentSales: number
    productViews: number
    wishlistAdds: number
    cartAdds: number
    recentReviews: number
    averageRating: number
  }
  timeWindow?: '24H' | '7D' | '30D'
  excludeOutOfStock: boolean
  excludeHiddenProducts: boolean
  excludeArchivedProducts: boolean
}

const DEFAULT_SETTINGS: TrendingSettings = {
  contentSource: 'HYBRID',
  maxProducts: 20,
  weights: {
    recentSales: 40,
    productViews: 20,
    wishlistAdds: 15,
    cartAdds: 15,
    recentReviews: 5,
    averageRating: 5,
  },
  timeWindow: '7D',
  excludeOutOfStock: true,
  excludeHiddenProducts: true,
  excludeArchivedProducts: true,
}

// GET /api/homepage-sections/trending-settings - Get trending settings (SUPER_ADMIN)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const prisma = getPrisma()
    const section = await prisma.homepageSection.findUnique({
      where: { slug: 'trending-now' },
    })

    if (!section) {
      return NextResponse.json({ settings: DEFAULT_SETTINGS })
    }

    const settings: TrendingSettings = section.settings
      ? { ...DEFAULT_SETTINGS, ...(section.settings as unknown as Partial<TrendingSettings>) }
      : DEFAULT_SETTINGS
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching trending settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/homepage-sections/trending-settings - Update trending settings (SUPER_ADMIN)
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const prisma = getPrisma()
    const body = await request.json()
    const { settings } = body as { settings: Partial<TrendingSettings> }

    const existing = await prisma.homepageSection.findUnique({
      where: { slug: 'trending-now' },
    })

    const mergedSettings = {
      ...(existing?.settings as Record<string, any> || {}),
      ...settings,
    }

    const section = await prisma.homepageSection.upsert({
      where: { slug: 'trending-now' },
      create: {
        name: 'Trending Now',
        slug: 'trending-now',
        type: HomepageSectionType.TRENDING_NOW,
        subtitle: 'Discover what\'s currently trending across Dhream Market.',
        displayOrder: 2,
        isEnabled: true,
        settings: mergedSettings as any,
      },
      update: {
        settings: mergedSettings as any,
      },
    })

    return NextResponse.json({ section })
  } catch (error) {
    console.error('Error updating trending settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}