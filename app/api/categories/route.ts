import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // During build, if database is not available, return empty categories to allow static generation
    if (process.env.NEXT_PHASE === 'phase-production-build') {
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

    // Return hierarchical list of categories
    const hierarchicalCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      children: cat.children || [],
    }))

    console.log('[API] Categories returned:', hierarchicalCategories.length)
    console.log('[API] First category:', JSON.stringify(hierarchicalCategories[0], null, 2))
    console.log('[API] All category IDs:', hierarchicalCategories.map(c => c.id))
    
    const response = NextResponse.json({ categories: hierarchicalCategories })
    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    return response
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}