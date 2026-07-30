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

    // Calculate ratings for each vendor
    const vendorsWithRatings = await Promise.all(
      featuredVendors.map(async (store) => {
        const reviews = await getPrisma().productReview.findMany({
          where: {
            product: {
              storeId: store.id,
            },
          },
          select: {
            rating: true,
          },
        })

        const averageRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0

        return {
          id: store.id,
          name: store.name,
          description: store.description,
          isVerified: store.isVerified,
          logo: store.logo,
          banner: store.banner,
          rating: Math.round(averageRating * 10) / 10,
          productCount: store._count.products,
          category: store.vendor_categories,
        }
      })
    )

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