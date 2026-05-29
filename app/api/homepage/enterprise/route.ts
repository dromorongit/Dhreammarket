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
      brandGroups,
    ] = await Promise.all([
      prisma.product.findMany({
        where: {
          flashSalePrice: { not: null },
          flashSaleStart: { lte: now },
          flashSaleEnd: { gte: now },
          stock: { gt: 0 },
        },
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.product.findMany({
        where: {
          isSponsored: true,
          stock: { gt: 0 },
        },
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.product.findMany({
        where: {
          OR: GADGET_CATEGORIES.map((slug) => ({
            category: {
              slug: { contains: slug, mode: 'insensitive' as const },
            },
          })),
          stock: { gt: 0 },
        },
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.product.findMany({
        where: { stock: { gt: 0 } },
        include: productInclude,
        orderBy: [{ salesCount: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      prisma.product.findMany({
        where: {
          flashSalePrice: { not: null },
          stock: { gt: 0 },
        },
        include: productInclude,
        take: 50,
      }),
      prisma.product.groupBy({
        by: ['brand'],
        where: {
          brand: { not: null },
          stock: { gt: 0 },
        },
        _count: { brand: true },
        orderBy: { _count: { brand: 'desc' } },
        take: 20,
      }),
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

    const brandNames = brandGroups
      .map((g) => g.brand)
      .filter((brand): brand is string => brand != null)

    const sampleProducts = brandNames.length
      ? await prisma.product.findMany({
          where: {
            brand: { in: brandNames },
            stock: { gt: 0 },
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

    const brands = brandGroups
      .filter((g) => g.brand)
      .map((g) => ({
        brand: g.brand as string,
        productCount: g._count.brand,
        store: storeByBrand.get(g.brand as string) ?? null,
      }))

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
        error: 'Internal server error',
        flashSales: [],
        sponsoredProducts: [],
        gadgetProducts: [],
        topSelling: [],
        bigDeals: [],
        brands: [],
      },
      { status: 500 }
    )
  }
}
