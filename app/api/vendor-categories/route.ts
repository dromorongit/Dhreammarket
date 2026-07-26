import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const categories = await getPrisma().vendorCategory.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: { stores: true },
        },
      },
    })
    perf.markPrismaEnd(prismaPerfStart)

    const categoriesWithCounts = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      productCount: cat._count.stores,
    }))

    const response = NextResponse.json({ categories: categoriesWithCounts })
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching vendor categories:', error)
    return NextResponse.json({ error: 'Failed to fetch vendor categories' }, { status: 500 })
  }
}
