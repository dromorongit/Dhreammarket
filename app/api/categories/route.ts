import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET() {
  try {
    // During build, if database is not available, return empty categories to allow static generation
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json({ categories: [] })
    }
    // Fetch all active categories with parentId to build tree
    const categories = await getPrisma().category.findMany({
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

    // Build tree
    const categoryMap = new Map<string, any>()
    const rootCategories: any[] = []

    for (const cat of categories) {
      categoryMap.set(cat.id, { ...cat, children: [] })
    }

    for (const cat of categories) {
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId)
        if (parent) {
          parent.children.push(categoryMap.get(cat.id)!)
        }
      } else {
        rootCategories.push(categoryMap.get(cat.id)!)
      }
    }

    return NextResponse.json({ categories: rootCategories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}