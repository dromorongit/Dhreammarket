import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET() {
  try {
    // During build, if database is not available, return empty categories to allow static generation
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ categories: [] })
    }
    // Fetch all active product categories with children for hierarchical display
    const categories = await getPrisma().productCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: { name: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    })

    // Return hierarchical list of categories
    const hierarchicalCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      children: cat.children || [],
    }))

    return NextResponse.json({ categories: hierarchicalCategories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}