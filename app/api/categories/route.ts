import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    // During build, if database is not available, return empty categories to allow static generation
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ categories: [] })
    }
    // Fetch only top-level active product categories with children for hierarchical display
    const categories = await getPrisma().productCategory.findMany({
      where: {
        isActive: true,
        parentId: null,
      },
      orderBy: { name: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            children: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    })
    perf.markPrismaEnd(prismaPerfStart)

    // Return hierarchical list of categories
    const hierarchicalCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      children: cat.children || [],
    }))

     const response = NextResponse.json({ categories: hierarchicalCategories })
     perf.log()
     return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}