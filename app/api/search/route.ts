import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { checkAndUpdateExpiredPreOrders } from '@/lib/product-availability'

const prisma = getPrisma()

export const dynamic = 'force-dynamic'

const LIMIT_PER_TYPE = 5

export async function GET(request: NextRequest) {
  // Rate limiting - security hardening
  const rateLimitCheck = rateLimit('search')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')?.trim()
    const typeFilter = searchParams.get('type') // optional: products | vendors | categories | brands

    if (!query || query.length < 1) {
      return NextResponse.json({
        query: '',
        results: { products: [], vendors: [], categories: [], brands: [] },
        total: 0,
      })
    }

    const searchTerm = `%${query.toLowerCase()}%`
    const results: Record<string, any[]> = {
      products: [],
      vendors: [],
      productCategories: [],
      vendorCategories: [],
      categories: [], // Alias for productCategories for backward compatibility
      brands: [],
    }

    // Search Products
    if (!typeFilter || typeFilter === 'products' || typeFilter === 'brands') {
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { brand: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          images: { take: 1 },
          store: { select: { id: true, slug: true, name: true, isVerified: true, badgeTier: true } },
          category: { select: { id: true, name: true } },
        },
        take: typeFilter === 'products' ? 20 : LIMIT_PER_TYPE,
        orderBy: { createdAt: 'desc' },
      })

      // Compute in-memory correction for expired pre-orders (instant)
      const now = new Date()
      const expiredIds = new Set(
        products
          .filter((p) => p.availabilityType === 'PREORDER' && p.expectedArrivalDate && new Date(p.expectedArrivalDate) < now)
          .map((p) => p.id)
      )

      // Fire-and-forget DB update for expired pre-orders
      if (expiredIds.size > 0) {
        void checkAndUpdateExpiredPreOrders(Array.from(expiredIds))
      }

      results.products = products.map((p) => {
        const isExpired = expiredIds.has(p.id) && p.availabilityType === 'PREORDER'
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          price: p.price,
          salesPrice: p.salesPrice,
          dealsPrice: p.dealsPrice,
          stock: p.stock,
          image: p.images?.[0]?.url || null,
          store: p.store,
          category: p.category,
          type: 'product',
          availabilityType: isExpired ? 'IN_STOCK' : p.availabilityType,
          expectedArrivalDate: isExpired ? null : p.expectedArrivalDate,
        }
      })
    }

    // Search Vendors (Stores)
    if (!typeFilter || typeFilter === 'vendors') {
      const vendors = await prisma.store.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          user: { select: { id: true } },
          vendor_categories: { select: { id: true, name: true, slug: true } },
          _count: { select: { products: true } },
        },
        take: LIMIT_PER_TYPE,
        orderBy: { createdAt: 'desc' },
      })

      results.vendors = vendors.map((v) => ({
        id: v.id,
        slug: v.slug,
        name: v.name,
        description: v.description,
        logo: v.logo,
        isVerified: v.isVerified,
        isFeatured: v.isFeatured,
        badgeTier: v.badgeTier,
        productCount: v._count?.products || 0,
        category: v.vendor_categories,
        type: 'vendor',
      }))
    }

    // Search Product Categories
    if (!typeFilter || typeFilter === 'categories' || typeFilter === 'product-categories') {
      const productCategories = await prisma.productCategory.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          _count: { select: { products: true } },
        },
        take: LIMIT_PER_TYPE,
        orderBy: { name: 'asc' },
      })

      results.productCategories = productCategories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: c._count?.products || 0,
        type: 'product-category',
      }))
      // Also set categories alias for backward compatibility
      results.categories = results.productCategories
    }

    // Search Vendor Categories
    if (!typeFilter || typeFilter === 'vendor-categories') {
      const vendorCategories = await prisma.vendorCategory.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          _count: { select: { stores: true } },
        },
        take: LIMIT_PER_TYPE,
        orderBy: { name: 'asc' },
      })

      results.vendorCategories = vendorCategories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        storeCount: c._count?.stores || 0,
        type: 'vendor-category',
      }))
    }

    // Search Brands (distinct brand values from products)
    if (!typeFilter || typeFilter === 'brands') {
      const allProducts = await prisma.product.findMany({
        where: {
          brand: { not: null, contains: query, mode: 'insensitive' },
        },
        select: {
          brand: true,
          _count: { select: { images: true } },
        },
        distinct: ['brand'],
        take: LIMIT_PER_TYPE,
      })

      // Get product counts per brand
      const brandCounts = await prisma.product.groupBy({
        by: ['brand'],
        where: {
          brand: { not: null, contains: query, mode: 'insensitive' },
        },
        _count: { id: true },
      })

      const brandCountMap = new Map(
        brandCounts.map((b) => [b.brand?.toLowerCase() ?? '', b._count.id])
      )

      results.brands = allProducts
        .filter((p) => p.brand)
        .map((p) => ({
          name: p.brand!,
          productCount: brandCountMap.get(p.brand!.toLowerCase()) || 0,
          type: 'brand',
        }))
    }

    const total = results.products.length + results.vendors.length + results.productCategories.length + results.vendorCategories.length + results.brands.length

    return NextResponse.json({
      query,
      results,
      total,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}