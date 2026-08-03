import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { getActiveSponsoredPlacements } from '@/lib/advertising/service'
import { logInfo, logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const entityType = searchParams.get('type') || 'PRODUCT'

    const prisma = getPrisma()

    let results: any[] = []

    if (entityType === 'PRODUCT' || entityType === 'all') {
      const productPlacements = await getActiveSponsoredPlacements('Sponsored')
      const sponsoredProductIds = productPlacements
        .filter((p) => p.type === 'PRODUCT')
        .map((p) => p.entityId)

      if (sponsoredProductIds.length > 0) {
        const products = await prisma.product.findMany({
          where: { id: { in: sponsoredProductIds } },
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            stock: true,
            salesCount: true,
            isSponsored: true,
            images: { take: 1 },
            category: { select: { id: true, name: true, slug: true } },
            store: { select: { id: true, name: true, isVerified: true, logo: true, badgeTier: true } },
          },
        })

        results = results.concat(
          products.map((p) => ({
            ...p,
            isSponsored: true,
            badge: 'Sponsored',
            searchBoost: true,
          }))
        )
      }
    }

    if (entityType === 'SERVICE' || entityType === 'all') {
      const servicePlacements = await getActiveSponsoredPlacements('Sponsored')
      const sponsoredServiceIds = servicePlacements
        .filter((p) => p.type === 'SERVICE')
        .map((p) => p.entityId)

      if (sponsoredServiceIds.length > 0) {
        const services = await prisma.service.findMany({
          where: { id: { in: sponsoredServiceIds } },
          select: {
            id: true,
            title: true,
            slug: true,
            startingPrice: true,
            availabilityStatus: true,
            thumbnail: true,
            images: { take: 1 },
            category: { select: { id: true, name: true, slug: true } },
            store: { select: { id: true, name: true, isVerified: true, logo: true, badgeTier: true } },
          },
        })

        results = results.concat(
          services.map((s) => ({
            ...s,
            isSponsored: true,
            badge: 'Sponsored',
            searchBoost: true,
          }))
        )
      }
    }

    return NextResponse.json({
      results,
      query,
      entityType,
      sponsoredCount: results.length,
    })
  } catch (error) {
    logError(`Error in search boosting: ${error}`)
    return NextResponse.json({ results: [], sponsoredCount: 0 })
  }
}