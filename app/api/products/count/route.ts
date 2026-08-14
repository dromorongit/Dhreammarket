import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const url = new URL(request.url)
    const categoryId = url.searchParams.get('categoryId')
    const brandId = url.searchParams.get('brandId')
    const vendorCategoryId = url.searchParams.get('vendorCategoryId')
    const minPrice = url.searchParams.get('minPrice')
    const maxPrice = url.searchParams.get('maxPrice')
    const availabilityType = url.searchParams.get('availabilityType')

    const whereClause: any = {
      OR: [
        { stock: { gt: 0 } },
        { availabilityType: 'PREORDER' },
        { availabilityType: 'BACKORDER' },
      ],
    }
    if (categoryId) {
      whereClause.OR = [
        { categoryId },
        { categoryAssignments: { some: { productCategoryId: categoryId } } },
      ]
    }
    if (brandId) {
      whereClause.brandId = brandId
    }
    if (vendorCategoryId) {
      whereClause.store = { categoryId: vendorCategoryId }
    }
    if (minPrice !== null) {
      const minPriceNum = parseFloat(minPrice)
      if (isNaN(minPriceNum) || minPriceNum < 0) {
        return NextResponse.json({ error: 'Invalid minPrice' }, { status: 400 })
      }
      whereClause.price = { ...(whereClause.price ?? {}), gte: minPriceNum }
    }
    if (maxPrice !== null) {
      const maxPriceNum = parseFloat(maxPrice)
      if (isNaN(maxPriceNum) || maxPriceNum < 0) {
        return NextResponse.json({ error: 'Invalid maxPrice' }, { status: 400 })
      }
      whereClause.price = { ...(whereClause.price ?? {}), lte: maxPriceNum }
    }
    if (availabilityType) {
      whereClause.availabilityType = availabilityType
    }

    const count = await getPrisma().product.count({ where: whereClause })
    perf.markPrismaEnd(prismaPerfStart)

    const response = NextResponse.json({ count })
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching product count:', error)
    return NextResponse.json({ error: 'Failed to fetch count' }, { status: 500 })
  }
}