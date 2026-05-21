import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

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

    // Format response
    const formatted = sections.map((section) => ({
      id: section.id,
      name: section.name,
      slug: section.slug,
      type: section.type,
      subtitle: section.subtitle,
      displayOrder: section.displayOrder,
      products: section.products.map((sp) => sp.product),
      vendors: section.vendors.map((sv) => sv.vendor),
    }))

    return NextResponse.json({ sections: formatted })
  } catch (error) {
    console.error('Error fetching public homepage sections:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
