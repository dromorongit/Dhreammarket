import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { PerformanceLogger } from '@/lib/performance'

export const revalidate = 3600

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ categories: [] })
    }
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

    const hierarchicalCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      children: cat.children || [],
    }))

     const response = NextResponse.json({ categories: hierarchicalCategories })
     response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400, max-age=300')
     perf.log()
     return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}