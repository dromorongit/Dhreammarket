import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit
    const status = url.searchParams.get('status')
    const vendorId = url.searchParams.get('vendorId')
    const customerId = url.searchParams.get('customerId')
    const categoryId = url.searchParams.get('categoryId')
    const search = url.searchParams.get('search')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (vendorId) {
      where.vendorId = vendorId
    }

    if (customerId) {
      where.customerId = customerId
    }

    if (categoryId) {
      where.service = { categoryId }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) dateFilter.lte = new Date(endDate)
      where.createdAt = dateFilter
    }

    const [requests, total] = await Promise.all([
      getPrisma().serviceRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          service: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnail: true,
              startingPrice: true,
              category: { select: { id: true, name: true, slug: true } },
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
          vendor: {
            select: {
              id: true,
              email: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
          store: {
            select: { id: true, name: true, slug: true, isVerified: true },
          },
          quotations: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              quotedPrice: true,
              status: true,
              vendorId: true,
              vendor: {
                select: { id: true, profile: { select: { firstName: true, lastName: true } } },
              },
            },
          },
        },
      }),
      getPrisma().serviceRequest.count({ where }),
    ])

    perf.markPrismaEnd(prismaPerfStart)

    const totalPages = Math.ceil(total / limit)

    const response = NextResponse.json({
      requests,
      pagination: { page, limit, total, totalPages },
    })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching admin service requests:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}
