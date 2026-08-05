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

    if (vendorCategoryId) {
      where.categoryId = vendorCategoryId
    }

    if (verified !== null) {
      where.isVerified = verified === 'true'
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    let orderBy: any = { createdAt: 'desc' }
    if (sortBy === 'rating' || sortBy === 'popular') {
      orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }]
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

    const storeIds = vendors.map((v) => v.id)

    const orderCountsByStore = storeIds.length > 0
      ? await getPrisma().orderItem.groupBy({
          by: ['productId'],
          where: {
            product: {
              storeId: { in: storeIds },
            },
            order: {
              status: { in: ['COMPLETED', 'DELIVERED'] },
            },
          },
          _count: {
            id: true,
          },
        })
      : []

    const productStoreMap = new Map<string, string>()
    if (storeIds.length > 0) {
      const products = await getPrisma().product.findMany({
        where: { storeId: { in: storeIds } },
        select: { id: true, storeId: true },
      })
      for (const p of products) {
        productStoreMap.set(p.id, p.storeId)
      }
    }

    const orderItemsByStore = new Map<string, number>()
    for (const group of orderCountsByStore) {
      const storeId = productStoreMap.get(group.productId as string)
      if (storeId) {
        orderItemsByStore.set(
          storeId,
          (orderItemsByStore.get(storeId) || 0) + (group._count?.id ?? 0)
        )
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

    const sortedVendors = vendorsWithMetrics.sort((a: any, b: any) => {
      if (a.isFeatured && !b.isFeatured) return -1
      if (!a.isFeatured && b.isFeatured) return 1
      if (b.rating !== a.rating) return b.rating - a.rating
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount
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
