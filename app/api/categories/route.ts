import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET() {
  try {
    // During build, if database is not available, return empty categories to allow static generation
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ categories: [] })
    }
    // Fetch all active product categories
    const categories = await getPrisma().productCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        _count: {
          select: { products: true },
        },
      },
    })

    // Return flat list of categories for the marketplace filter
    const flatCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      productCount: cat._count?.products || 0,
    }))

    return NextResponse.json({ categories: flatCategories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}