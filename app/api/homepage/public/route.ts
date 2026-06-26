import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { ensureDefaultHomepageSections } from '@/lib/homepage-default-sections'

export const dynamic = 'force-dynamic'

const productSelect = {
  id: true,
  slug: true,
  name: true,
  price: true,
  flashSalePrice: true,
  flashSaleStart: true,
  flashSaleEnd: true,
  salesPrice: true,
  dealsPrice: true,
  stock: true,
  salesCount: true,
  isSponsored: true,
  brand: true,
  availabilityType: true,
  expectedArrivalDate: true,
  estimatedFulfillmentDays: true,
  preOrderNotes: true,
  expectedRestockDate: true,
  backOrderNotes: true,
  images: { select: { id: true, url: true, alt: true } },
  category: { select: { id: true, name: true, slug: true } },
  store: {
    select: { id: true, name: true, isVerified: true, logo: true, badgeTier: true },
  },
} as const

// GET /api/homepage/public - Managed homepage sections + brands (public)
export async function GET(_request: NextRequest) {
  let sections: any[] = []
  let brands: any[] = []

  try {
    const prisma = getPrisma()
    try {
      await ensureDefaultHomepageSections(prisma)
      console.log('[homepage/public] ensureDefaultHomepageSections completed')
    } catch (e) {
      console.error('[homepage/public] ensureDefaultHomepageSections failed:', e)
    }

    // Fetch sections with individual try/catch
    try {
      sections = await prisma.homepageSection.findMany({
        where: { isEnabled: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          products: {
            orderBy: { displayOrder: 'asc' },
            select: {
              product: {
                select: productSelect,
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
                      badgeTier: true,
                      _count: { select: { products: true } },
                    },
                  },
                },
              },
            },
            take: 10,
          },
        },
      })
      console.log('[homepage/public] homepageSection.findMany succeeded, count:', sections.length)
    } catch (e) {
      console.error('[homepage/public] homepageSection.findMany FAILED:', e)
      sections = []
    }

    // Fetch brands with individual try/catch
    try {
      brands = await prisma.brand.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: {
              products: {
                where: {
                  OR: [
                    { stock: { gt: 0 } },
                    { availabilityType: 'PREORDER' },
                    { availabilityType: 'BACKORDER' },
                  ],
                },
              },
            },
          },
        },
      })
      console.log('[homepage/public] brand.findMany succeeded, count:', brands.length)
    } catch (e) {
      console.error('[homepage/public] brand.findMany FAILED:', e)
      brands = []
    }
  } catch (error) {
    console.error('Error fetching public homepage sections (outer):', error)
  }

  const formatted = (sections || []).map((section) => {
    const sortedProducts = (section.products || [])
      .map((sp: any) => sp.product)
      .filter((p: any) => p && (p.stock > 0 || p.availabilityType === 'PREORDER' || p.availabilityType === 'BACKORDER'))

    return {
      id: section.id,
      name: section.name,
      slug: section.slug,
      type: section.type,
      subtitle: section.subtitle,
      displayOrder: section.displayOrder,
      products: sortedProducts,
vendors: (section.vendors || [])
        .map((sv: any) => ({
          ...sv.vendor,
          slug: sv.vendor.store?.slug ?? null,
          badgeTier: sv.vendor.store?.badgeTier ?? null,
          storeName: sv.vendor.store?.name ?? sv.vendor.name,
          productCount: sv.vendor.store?._count?.products ?? 0,
        }))
        .filter(Boolean),
    }
  })

  const formattedBrands = (brands || []).map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logo: brand.logo,
    description: brand.description,
    productCount: brand._count?.products ?? 0,
  }))

  const response = NextResponse.json({
    sections: formatted,
    brands: formattedBrands,
  })
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  return response
}
