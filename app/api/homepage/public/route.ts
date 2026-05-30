import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { ensureDefaultHomepageSections } from '@/lib/homepage-default-sections'

export const dynamic = 'force-dynamic'

const productInclude = {
  images: true,
  category: true,
  store: {
    select: { id: true, name: true, isVerified: true, logo: true },
  },
} as const

// GET /api/homepage/public - Managed homepage sections + brands (public)
export async function GET(_request: NextRequest) {
  try {
    const prisma = getPrisma()
    await ensureDefaultHomepageSections(prisma)

    const [sections, brands] = await Promise.all([
      prisma.homepageSection.findMany({
        where: { isEnabled: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          products: {
            orderBy: { displayOrder: 'asc' },
            include: {
              product: {
                include: productInclude,
              },
            },
          },
          vendors: {
            include: {
              vendor: {
                include: {
                  profile: true,
                  store: {
                    select: {
                      id: true,
                      name: true,
                      isVerified: true,
                      isFeatured: true,
                      logo: true,
                    },
                  },
                },
              },
            },
            take: 10,
          },
        },
      }),
      prisma.brand.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: {
              products: {
                where: { stock: { gt: 0 } },
              },
            },
          },
        },
      }),
    ])

    const formatted = sections.map((section) => {
      const sortedProducts = (section.products || [])
        .map((sp) => sp.product)
        .filter((p) => p && p.stock > 0)

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

    const formattedBrands = brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logo: brand.logo,
      description: brand.description,
      productCount: brand._count.products,
    }))

    const response = NextResponse.json({
      sections: formatted,
      brands: formattedBrands,
    })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    return response
  } catch (error) {
    console.error('Error fetching public homepage sections:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
