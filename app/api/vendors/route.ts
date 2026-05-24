import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vendorCategoryId = searchParams.get('vendorCategoryId')
    const verified = searchParams.get('verified')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'newest' // 'newest', 'rating', 'popular'

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      user: { role: 'VENDOR' },
      categoryId: { not: null },
    }

    // Filter by vendor category
    if (vendorCategoryId) {
      where.categoryId = vendorCategoryId
    }

    // Filter by verification status
    if (verified !== null) {
      where.isVerified = verified === 'true'
    }

    // Search by store name or vendor email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Determine orderBy based on sortBy parameter
    let orderBy: any = { createdAt: 'desc' }
    if (sortBy === 'rating') {
      orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }] // Featured first, then by date as secondary
    } else if (sortBy === 'popular') {
      orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }] // Featured first, then by date as secondary
    }

    const [vendors, total] = await Promise.all([
      getPrisma().store.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
            },
          },
          vendor_categories: {
            select: {
              id: true,
              name: true,
              slug: true,
            }
          },
          _count: {
            select: { products: true },
          },
        },
      }),
      getPrisma().store.count({ where }),
    ])

    // Calculate ratings and order counts for each vendor
    const vendorsWithMetrics = await Promise.all(
      vendors.map(async (store) => {
        // Get reviews for rating
        const reviews = await getPrisma().review.findMany({
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

        // Get order count for popularity
        const orderItems = await getPrisma().orderItem.findMany({
          where: {
            product: {
              storeId: store.id,
            },
          },
          include: {
            order: {
              select: {
                status: true,
              },
            },
          },
        })

        // Count completed orders only
        const orderCount = orderItems.filter(item =>
          item.order.status === 'COMPLETED' || item.order.status === 'DELIVERED'
        ).length

        // Check if featured status is still valid
        const now = new Date()
        const isCurrentlyFeatured = (store as any).isFeatured &&
          (store as any).featuredUntil &&
          new Date((store as any).featuredUntil) > now

        return {
          ...store,
          isFeatured: isCurrentlyFeatured,
          rating: Math.round(averageRating * 10) / 10,
          orderCount,
        }
      })
    )

    // Apply ranking logic: Featured first, then by rating, then by order count, then by newest
    const sortedVendors = vendorsWithMetrics.sort((a: any, b: any) => {
      // Featured vendors first
      if (a.isFeatured && !b.isFeatured) return -1
      if (!a.isFeatured && b.isFeatured) return 1
      // Then by rating (highest first)
      if (b.rating !== a.rating) return b.rating - a.rating
      // Then by order count (popularity)
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount
      // Then by newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      vendors: sortedVendors,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Vendors error:', error)
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 })
  }
}
