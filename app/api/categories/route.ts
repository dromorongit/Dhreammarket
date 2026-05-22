import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET() {
  try {
    // During build, if database is not available, return empty categories to allow static generation
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ categories: [] })
    }
    const categories = await getPrisma().category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}