import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { ensureDefaultHomepageSections } from '@/lib/homepage-default-sections'
import { checkAndUpdateExpiredPreOrders } from '@/lib/product-availability'

export const dynamic = 'force-dynamic'

interface TrendingWeights {
  recentSales: number
  productViews: number
  wishlistAdds: number
  cartAdds: number
  recentReviews: number
  averageRating: number
}

const DEFAULT_WEIGHTS: TrendingWeights = {
  recentSales: 40,
  productViews: 20,
  wishlistAdds: 15,
  cartAdds: 15,
  recentReviews: 5,
  averageRating: 5,
}

async function getAutomaticTrendingProducts(prisma: ReturnType<typeof getPrisma>, settings: TrendingWeights & { timeWindow: '24H' | '7D' | '30D' }, maxProducts: number): Promise<any[]> {
  const now = new Date()
  const timeWindowMap: Record<string, number> = {
    '24H': 24 * 60 * 60 * 1000,
    '7D': 7 * 24 * 60 * 60 * 1000,
    '30D': 30 * 24 * 60 * 60 * 1000,
  }
  const cutoffDate = new Date(now.getTime() - timeWindowMap[settings.timeWindow])

  const products = await prisma.product.findMany({
    where: {
      stock: { gt: 0 },
      OR: [
        { availabilityType: 'IN_STOCK' },
        { availabilityType: 'PREORDER' },
        { availabilityType: 'BACKORDER' },
      ],
    },
    include: {
      images: { take: 1 },
      category: { select: { id: true, name: true, slug: true } },
      store: { select: { id: true, name: true, isVerified: true, logo: true, badgeTier: true } },
      _count: {
        select: {
          productReviews: true,
          orderItems: {
            where: {
              order: {
                createdAt: { gte: cutoffDate },
                status: { in: ['COMPLETED', 'DELIVERED'] },
              },
            },
          },
        },
      },
    },
    take: 100,
  })

  // Compute in-memory correction for expired pre-orders (instant)
  const expiredIds = new Set(
    products
      .filter((p) => p.availabilityType === 'PREORDER' && p.expectedArrivalDate && new Date(p.expectedArrivalDate) < now)
      .map((p) => p.id)
  )

  // Fire-and-forget DB update for expired pre-orders
  if (expiredIds.size > 0) {
    void checkAndUpdateExpiredPreOrders(Array.from(expiredIds))
  }

  return products
    .map((product) => {
      const salesScore = (product._count?.orderItems ?? 0) * DEFAULT_WEIGHTS.recentSales
      const reviewScore = (product.averageRating ?? 0) * DEFAULT_WEIGHTS.averageRating
      const reviewCountScore = (product._count?.productReviews ?? 0) * DEFAULT_WEIGHTS.recentReviews * 0.1

      // If this was an expired pre-order, update the in-memory object
      if (expiredIds.has(product.id) && product.availabilityType === 'PREORDER') {
        return {
          ...product,
          trendingScore: salesScore + reviewScore + reviewCountScore,
          availabilityType: 'IN_STOCK',
          expectedArrivalDate: null,
        }
      }

      return {
        ...product,
        trendingScore: salesScore + reviewScore + reviewCountScore,
      }
    })
    .sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0))
    .slice(0, maxProducts)
}

const productSelect = {
  id: true,
  slug: true,
  name: true,
  price: true,
  flashSalePrice: true,
  flashSaleStart: true,
  flashSaleEnd: true,
  salesPrice: true,
  dealsPrice: true,
  stock: true,
  salesCount: true,
  isSponsored: true,
  brand: true,
  availabilityType: true,
  expectedArrivalDate: true,
  estimatedFulfillmentDays: true,
  preOrderNotes: true,
  expectedRestockDate: true,
  backOrderNotes: true,
  images: { select: { id: true, url: true, alt: true } },
  category: { select: { id: true, name: true, slug: true } },
  store: {
    select: { id: true, name: true, isVerified: true, logo: true, badgeTier: true },
  },
} as const

// GET /api/homepage/public - Managed homepage sections + brands (public)
export async function GET(_request: NextRequest) {
  let sections: any[] = []
  let brands: any[] = []
  let prismaInstance: ReturnType<typeof getPrisma> | null = null

  try {
    const prisma = getPrisma()
    prismaInstance = prisma
    try {
      await ensureDefaultHomepageSections(prisma)
      console.log('[homepage/public] ensureDefaultHomepageSections completed')
    } catch (e) {
      console.error('[homepage/public] ensureDefaultHomepageSections failed:', e)
    }

    // Fetch sections with individual try/catch
    try {
      sections = await prisma.homepageSection.findMany({
        where: { isEnabled: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          products: {
            orderBy: { displayOrder: 'asc' },
            select: {
              product: {
                select: productSelect,
              },
            },
          },
          vendors: {
            include: {
              vendor: {
                include: {
                  profile: true,
                  store: {
                    select: {
                      id: true,
                      name: true,
                      isVerified: true,
                      isFeatured: true,
                      logo: true,
                      badgeTier: true,
                      _count: { select: { products: true } },
                    },
                  },
                },
              },
            },
            take: 10,
          },
        },
      })
      console.log('[homepage/public] homepageSection.findMany succeeded, count:', sections.length)
    } catch (e) {
      console.error('[homepage/public] homepageSection.findMany FAILED:', e)
      sections = []
    }

    // Fetch brands with individual try/catch
    try {
      brands = await prisma.brand.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: {
              products: {
                where: {
                  OR: [
                    { stock: { gt: 0 } },
                    { availabilityType: 'PREORDER' },
                    { availabilityType: 'BACKORDER' },
                  ],
                },
              },
            },
          },
        },
      })
      console.log('[homepage/public] brand.findMany succeeded, count:', brands.length)
    } catch (e) {
      console.error('[homepage/public] brand.findMany FAILED:', e)
      brands = []
    }
  } catch (error) {
    console.error('Error fetching public homepage sections (outer):', error)
  }

const formatted = await Promise.all((sections || []).map(async (section) => {
    let sortedProducts: any[] = []
    const now = new Date()
    
    if (section.type === 'TRENDING_NOW' && prismaInstance) {
      const settings = section.settings as any
      if (settings?.mode === 'AUTOMATIC') {
        const trendingSettings = {
          ...DEFAULT_WEIGHTS,
          timeWindow: settings?.timeWindow || '7D',
        }
        sortedProducts = await getAutomaticTrendingProducts(prismaInstance, trendingSettings, settings?.maxProducts || 20)
      } else {
        sortedProducts = (section.products || [])
          .map((sp: any) => sp.product)
          .filter((p: any) => p && (p.stock > 0 || p.availabilityType === 'PREORDER' || p.availabilityType === 'BACKORDER'))
      }
    } else {
      sortedProducts = (section.products || [])
        .map((sp: any) => sp.product)
        .filter((p: any) => p && (p.stock > 0 || p.availabilityType === 'PREORDER' || p.availabilityType === 'BACKORDER'))
    }

    // Compute in-memory correction for expired pre-orders in this section (instant)
    const expiredIds = new Set(
      sortedProducts
        .filter((p: any) => p && p.availabilityType === 'PREORDER' && p.expectedArrivalDate && new Date(p.expectedArrivalDate) < now)
        .map((p: any) => p.id)
    )

    // Fire-and-forget DB update for expired pre-orders
    if (expiredIds.size > 0) {
      void checkAndUpdateExpiredPreOrders(Array.from(expiredIds))
    }

    sortedProducts = sortedProducts.map((p: any) =>
      p && expiredIds.has(p.id) ? { ...p, availabilityType: 'IN_STOCK', expectedArrivalDate: null } : p
    )

    return {
      id: section.id,
      name: section.name,
      slug: section.slug,
      type: section.type,
      subtitle: section.subtitle,
      displayOrder: section.displayOrder,
      products: sortedProducts,
vendors: (section.vendors || [])
        .map((sv: any) => ({
          ...sv.vendor,
          slug: sv.vendor.store?.slug ?? null,
          badgeTier: sv.vendor.store?.badgeTier ?? null,
          storeName: sv.vendor.store?.name ?? sv.vendor.name,
          productCount: sv.vendor.store?._count?.products ?? 0,
        }))
        .filter(Boolean),
    }
  }))

  const formattedBrands = (brands || []).map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logo: brand.logo,
    description: brand.description,
    productCount: brand._count?.products ?? 0,
  }))

  const response = NextResponse.json({
    sections: formatted,
    brands: formattedBrands,
  })
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  return response
}
