import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { getDiscountPercent } from '@/lib/homepage-product-utils'

export const dynamic = 'force-dynamic'

const GADGET_CATEGORIES = ['electronics', 'phones', 'laptops', 'accessories', 'gaming', 'gadgets']

const productInclude = {
  images: true,
  category: true,
  store: {
    select: { id: true, name: true, isVerified: true, logo: true },
  },
} as const

const inStockWhere = { stock: { gt: 0 } } as const

async function safeFindProducts<T>(
  label: string,
  query: () => Promise<T[]>,
  fallback?: () => Promise<T[]>
): Promise<T[]> {
  try {
    return await query()
  } catch (error) {
    console.error(`Enterprise homepage query failed (${label}):`, error)
    if (fallback) {
      try {
        return await fallback()
      } catch (fallbackError) {
        console.error(`Enterprise homepage fallback failed (${label}):`, fallbackError)
      }
    }
    return []
  }
}

// GET /api/homepage/enterprise - Get all enterprise section data in one request
export async function GET(_request: NextRequest) {
  try {
    const prisma = getPrisma()
    const now = new Date()

    const [
      flashSaleProducts,
      sponsoredProducts,
      gadgetProducts,
      topSellingProducts,
      bigDealsRaw,
    ] = await Promise.all([
      safeFindProducts('flashSales', () =>
        prisma.product.findMany({
          where: {
            flashSalePrice: { not: null },
            flashSaleStart: { lte: now },
            flashSaleEnd: { gte: now },
            ...inStockWhere,
          },
          include: productInclude,
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      ),
      safeFindProducts('sponsoredProducts', () =>
        prisma.product.findMany({
          where: {
            isSponsored: true,
            ...inStockWhere,
          },
          include: productInclude,
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      ),
      safeFindProducts('gadgetProducts', () =>
        prisma.product.findMany({
          where: {
            OR: GADGET_CATEGORIES.map((slug) => ({
              category: {
                slug: { contains: slug, mode: 'insensitive' as const },
              },
            })),
            ...inStockWhere,
          },
          include: productInclude,
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      ),
      safeFindProducts(
        'topSelling',
        () =>
          prisma.product.findMany({
            where: inStockWhere,
            include: productInclude,
            orderBy: [{ salesCount: 'desc' }, { createdAt: 'desc' }],
            take: 20,
          }),
        () =>
          prisma.product.findMany({
            where: inStockWhere,
            include: productInclude,
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
      ),
      safeFindProducts('bigDeals', () =>
        prisma.product.findMany({
          where: {
            flashSalePrice: { not: null },
            ...inStockWhere,
          },
          include: productInclude,
          take: 50,
        })
      ),
    ])

    const bigDealsProducts = bigDealsRaw
      .filter((p) => getDiscountPercent(p.price, p.flashSalePrice) > 0)
      .sort((a, b) => {
        const discountDiff =
          getDiscountPercent(b.price, b.flashSalePrice) -
          getDiscountPercent(a.price, a.flashSalePrice)
        if (discountDiff !== 0) return discountDiff
        return b.createdAt.getTime() - a.createdAt.getTime()
      })
      .slice(0, 20)

    let brands: Array<{ brand: string; productCount: number; store: unknown }> = []

    try {
      const brandGroups = await prisma.product.groupBy({
        by: ['brand'],
        where: {
          brand: { not: null },
          ...inStockWhere,
        },
        _count: { brand: true },
        orderBy: { _count: { brand: 'desc' } },
        take: 20,
      })

      const brandNames = brandGroups
        .map((g) => g.brand)
        .filter((brand): brand is string => brand != null)

      const sampleProducts = brandNames.length
        ? await prisma.product.findMany({
            where: {
              brand: { in: brandNames },
              ...inStockWhere,
            },
            select: {
              brand: true,
              store: {
                select: { id: true, name: true, logo: true },
              },
            },
            distinct: ['brand'],
          })
        : []

      const storeByBrand = new Map(
        sampleProducts
          .filter((p) => p.brand)
          .map((p) => [p.brand as string, p.store])
      )

      brands = brandGroups
        .filter((g) => g.brand)
        .map((g) => ({
          brand: g.brand as string,
          productCount: g._count.brand,
          store: storeByBrand.get(g.brand as string) ?? null,
        }))
    } catch (error) {
      console.error('Enterprise homepage brand query failed:', error)
    }

    const response = NextResponse.json({
      flashSales: flashSaleProducts || [],
      sponsoredProducts: sponsoredProducts || [],
      gadgetProducts: gadgetProducts || [],
      topSelling: topSellingProducts || [],
      bigDeals: bigDealsProducts || [],
      brands: brands || [],
    })

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    return response
  } catch (error) {
    console.error('Error fetching enterprise homepage data:', error)
    return NextResponse.json(
      {
        flashSales: [],
        sponsoredProducts: [],
        gadgetProducts: [],
        topSelling: [],
        bigDeals: [],
        brands: [],
      },
      { status: 200 }
    )
  }
}
