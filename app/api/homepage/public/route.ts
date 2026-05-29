import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'

// GET /api/homepage/public - Get all enabled homepage sections with their products/vendors (public)
export async function GET(request: NextRequest) {
  try {
    const prisma = getPrisma()

    const sections = await prisma.homepageSection.findMany({
      where: { isEnabled: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: true,
                category: true,
                store: {
                  select: { id: true, name: true, isVerified: true },
                },
              },
            },
          },
          take: 20,
        },
        vendors: {
          include: {
            vendor: {
              include: {
                profile: true,
                store: {
                  select: { id: true, name: true, isVerified: true, isFeatured: true, logo: true },
                },
              },
            },
          },
          take: 10,
        },
      },
    })

    // Format response - sort by newest
    const formatted = sections.map((section) => {
      // Sort products by newest first
      const sortedProducts = (section.products || [])
        .map((sp) => sp.product)
        .filter(Boolean)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
      return {
        id: section.id,
        name: section.name,
        slug: section.slug,
        type: section.type,
        subtitle: section.subtitle,
        displayOrder: section.displayOrder,
        products: sortedProducts,
        vendors: (section.vendors || []).map((sv) => sv.vendor).filter(Boolean),
      }
    })

    const response = NextResponse.json({ sections: formatted })
    // Prevent caching to ensure fresh products appear
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    return response
  } catch (error) {
    console.error('Error fetching public homepage sections:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
