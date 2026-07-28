import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '24', 10)
    const skip = (page - 1) * limit
    const categoryId = url.searchParams.get('categoryId')
    const vendorId = url.searchParams.get('vendorId')
    const pricingType = url.searchParams.get('pricingType')
    const availabilityStatus = url.searchParams.get('availabilityStatus')
    const deliveryType = url.searchParams.get('deliveryType')
    const minPrice = url.searchParams.get('minPrice')
    const maxPrice = url.searchParams.get('maxPrice')
    const search = url.searchParams.get('search')
    const isFeatured = url.searchParams.get('isFeatured')
    const sortBy = url.searchParams.get('sortBy') || 'createdAt'
    const sortOrder = url.searchParams.get('sortOrder') || 'desc'

    const where: Record<string, unknown> = {
      status: 'PUBLISHED',
      isActive: true,
    }

    if (isFeatured !== null) {
      where.isFeatured = isFeatured === 'true'
    }

    if (categoryId) {
      where.categoryId = categoryId
      where.category = { isActive: true }
    }

    if (vendorId) {
      where.vendorId = vendorId
    }

    if (pricingType) {
      where.pricingType = pricingType
    }

    if (availabilityStatus) {
      where.availabilityStatus = availabilityStatus
    }

    if (deliveryType) {
      where.deliveryType = deliveryType
    }

    if (minPrice !== null) {
      where.startingPrice = { ...(where.startingPrice as Record<string, unknown> ?? {}), gte: parseFloat(minPrice) }
    }

    if (maxPrice !== null) {
      where.startingPrice = { ...(where.startingPrice as Record<string, unknown> ?? {}), lte: parseFloat(maxPrice) }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ]
    }

    let orderBy: Record<string, string> | Array<Record<string, string>>
    switch (sortBy) {
      case 'price-low':
        orderBy = { startingPrice: sortOrder }
        break
      case 'price-high':
        orderBy = { startingPrice: sortOrder === 'asc' ? 'desc' : 'asc' }
        break
      case 'oldest':
        orderBy = { createdAt: sortOrder === 'asc' ? 'desc' : 'asc' }
        break
      case 'alphabetical':
        orderBy = { title: sortOrder }
        break
      case 'featured':
        orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }]
        break
      case 'newest':
      default:
        orderBy = { createdAt: sortOrder }
        break
    }

    const [services, total] = await Promise.all([
      getPrisma().service.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          slug: true,
          title: true,
          shortDescription: true,
          description: true,
          startingPrice: true,
          pricingType: true,
          thumbnail: true,
          tags: true,
          isFeatured: true,
          status: true,
          createdAt: true,
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
              isVerified: true,
              logo: true,
              badgeTier: true,
              averageRating: true,
              reviewCount: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          images: {
            orderBy: {
              displayOrder: 'asc',
            },
            select: {
              id: true,
              imageUrl: true,
              displayOrder: true,
            },
          },
        },
      }),
      getPrisma().service.count({ where }),
    ])
    perf.markPrismaEnd(prismaPerfStart)

    const totalPages = Math.ceil(total / limit)

    const response = NextResponse.json({
      services,
      pagination: { page, limit, total, totalPages },
    })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching services:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}