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
    const isActive = url.searchParams.get('isActive')
    const sortBy = url.searchParams.get('sortBy') || 'createdAt'
    const sortOrder = url.searchParams.get('sortOrder') || 'desc'

    const where: Record<string, unknown> = {}

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (vendorId) {
      where.vendorId = vendorId
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const [services, total] = await Promise.all([
      getPrisma().service.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
              isVerified: true,
              logo: true,
              badgeTier: true,
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