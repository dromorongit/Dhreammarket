import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const skip = (page - 1) * limit
    const now = new Date()

    // Fetch featured vendors with valid featuredUntil dates
    const featuredVendors = await getPrisma().store.findMany({
      where: {
        isFeatured: true,
        featuredUntil: {
          gt: now,
        },
        categoryId: { not: null },
      },
      include: {
        user: {
          select: {
            id: true,
          },
        },
        vendor_categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: { products: true },
        },
      },
      orderBy: { featuredUntil: 'desc' },
      skip,
      take: limit,
    })

    const total = await getPrisma().store.count({
      where: {
        isFeatured: true,
        featuredUntil: { gt: now },
        categoryId: { not: null },
      },
    })

    const storeIds = featuredVendors.map((s) => s.id)

    const ratingsResult = await getPrisma().$queryRaw<
      { storeId: string; avgRating: number }[]
    >`
      SELECT p."storeId" as "storeId", AVG(pr.rating) as "avgRating"
      FROM product_reviews pr
      INNER JOIN products p ON p.id = pr."productId"
      WHERE p."storeId" IN (${storeIds})
      GROUP BY p."storeId"
    `

    const avgRatingByStore = new Map(
      ratingsResult.map((r) => [r.storeId, Math.round(r.avgRating * 10) / 10]),
    )

    const vendorsWithRatings = featuredVendors.map((store) => ({
      id: store.id,
      name: store.name,
      description: store.description,
      isVerified: store.isVerified,
      badgeTier: store.badgeTier,
      logo: store.logo,
      banner: store.banner,
      rating: avgRatingByStore.get(store.id) || 0,
      productCount: store._count.products,
      category: store.vendor_categories,
    }))

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      vendors: vendorsWithRatings,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error('Featured vendors error:', error)
    return NextResponse.json({ error: 'Failed to fetch featured vendors' }, { status: 500 })
  }
}