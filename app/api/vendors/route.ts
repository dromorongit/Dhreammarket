import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const { searchParams } = new URL(request.url)
    const vendorCategoryId = searchParams.get('vendorCategoryId')
    const verified = searchParams.get('verified')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const sortBy = ['newest', 'rating', 'popular'].includes(searchParams.get('sortBy') || 'newest')
      ? searchParams.get('sortBy')!
      : 'newest'

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
    perf.markPrismaEnd(prismaPerfStart)

// Use cached ratings from database
     const storeIds = vendors.map((v) => v.id)
     const orderItemsByStore = new Map<string, number>()
     
     if (storeIds.length > 0) {
       const allOrderItems = await getPrisma().orderItem.findMany({
         where: {
           product: {
             storeId: { in: storeIds },
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

       for (const item of allOrderItems) {
         const storeId = (item as any).product?.storeId
         if (storeId && (item.order.status === 'COMPLETED' || item.order.status === 'DELIVERED')) {
           orderItemsByStore.set(storeId, (orderItemsByStore.get(storeId) || 0) + 1)
         }
       }
     }

     const now = new Date()
     const vendorsWithMetrics = vendors.map((store) => ({
       ...store,
       isFeatured: store.isFeatured && store.featuredUntil && new Date(store.featuredUntil) > now,
       rating: store.averageRating,
       orderCount: orderItemsByStore.get(store.id) || 0,
       category: store.vendor_categories,
     }))

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

    const response = NextResponse.json({
      vendors: sortedVendors,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
    response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300, max-age=30')
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Vendors error:', error)
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 })
  }
}
