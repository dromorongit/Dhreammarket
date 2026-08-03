import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import {
  getActiveSponsoredPlacements,
  deduplicateHomepageItems,
  getHomepageRenderContext,
} from '@/lib/advertising/service'
import { logInfo, logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sectionSlug = searchParams.get('section') || 'Sponsored'
    const maxSlots = parseInt(searchParams.get('maxSlots') || '10', 10)

    const prisma = getPrisma()
    const now = new Date()

    const activeCampaigns = await prisma.advertisementCampaign.findMany({
      where: {
        campaignStatus: 'ACTIVE',
        paymentStatus: 'PAID',
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        placements: {
          where: { sectionSlug },
          orderBy: { displayOrder: 'asc' },
        },
      },
    })

    const sponsoredPlacements = await getActiveSponsoredPlacements(sectionSlug)

    const sponsoredEntityIds = new Set(
      sponsoredPlacements.flatMap((p) => [p.entityId].filter(Boolean) as string[])
    )

    return NextResponse.json({
      sponsoredPlacements,
      sponsoredEntityIds: Array.from(sponsoredEntityIds),
      sectionSlug,
      maxSlots,
      count: sponsoredPlacements.length,
    })
  } catch (error) {
    logError(`Error fetching sponsored placements: ${error}`)
    return NextResponse.json({ sponsoredPlacements: [], sponsoredEntityIds: [], count: 0 })
  }
}