import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ categories: [] })
    }

    const categories = await getPrisma().serviceCategory.findMany({
      orderBy: { name: 'asc' },
    })
    perf.markPrismaEnd(prismaPerfStart)

    const hierarchicalCategories = categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
    }))

    const response = NextResponse.json({ categories: hierarchicalCategories })
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching service categories:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}
