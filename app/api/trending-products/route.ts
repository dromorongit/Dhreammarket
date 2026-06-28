import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { ensureDefaultHomepageSections } from '@/lib/homepage-default-sections'

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

async function calculateTrendingProducts(
  prisma: ReturnType<typeof getPrisma>,
  settings: TrendingWeights & { timeWindow: '24H' | '7D' | '30D' },
  maxProducts: number,
): Promise<any[]> {
  const now = new Date()
  const timeWindowMap = {
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

  const scoredProducts = products.map((product) => {
    const salesScore = (product._count?.orderItems ?? 0) * DEFAULT_WEIGHTS.recentSales
    const reviewScore = (product.averageRating ?? 0) * DEFAULT_WEIGHTS.averageRating
    const reviewCountScore = (product._count?.productReviews ?? 0) * DEFAULT_WEIGHTS.recentReviews * 0.1

    const totalScore = salesScore + reviewScore + reviewCountScore

    return {
      ...product,
      trendingScore: totalScore,
    }
  })

  return scoredProducts
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, maxProducts)
}

// GET /api/trending-products - Get automatic trending products (public)
export async function GET(request: NextRequest) {
  try {
    const prisma = getPrisma()
    
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'automatic'
    const maxProducts = parseInt(searchParams.get('limit') || '20', 10)

    if (mode === 'automatic') {
      const trendingProducts = await calculateTrendingProducts(prisma, {
        ...DEFAULT_WEIGHTS,
        timeWindow: '7D',
      }, maxProducts)

      return NextResponse.json({ products: trendingProducts, mode: 'AUTOMATIC' })
    }

    return NextResponse.json({ products: [], mode: 'MANUAL' })
  } catch (error) {
    console.error('Error fetching trending products:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}