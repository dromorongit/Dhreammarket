import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q')?.trim()
    const type = request.nextUrl.searchParams.get('type')

    if (!query || query.length < 1) {
      return NextResponse.json({
        query: '',
        results: { products: [], services: [], vendors: [], categories: [], brands: [], suggestions: [] },
        total: 0,
      })
    }

    const results: Record<string, any[]> = {
      products: [],
      services: [],
      vendors: [],
      categories: [],
      brands: [],
      suggestions: [],
    }

    try {
      const products = await getPrisma().product.findMany({
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
        take: 10,
        orderBy: { salesCount: 'desc' },
      })

      results.products = products.map((p) => ({
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
        availabilityType: p.availabilityType,
      }))
    } catch (error) {
      console.error('Search products error:', error)
    }

    try {
      const services = await getPrisma().service.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { shortDescription: { contains: query, mode: 'insensitive' } },
          ],
          status: 'PUBLISHED',
          isActive: true,
        },
        include: {
          store: { select: { id: true, slug: true, name: true, isVerified: true, badgeTier: true } },
          category: { select: { id: true, name: true } },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      })

      results.services = services.map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        shortDescription: s.shortDescription,
        startingPrice: s.startingPrice,
        pricingType: s.pricingType,
        deliveryType: s.deliveryType,
        thumbnail: s.thumbnail,
        store: s.store,
        category: s.category,
        type: 'service',
      }))
    } catch (error) {
      console.error('Search services error:', error)
    }

    try {
      const vendors = await getPrisma().store.findMany({
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
        take: 5,
        orderBy: { averageRating: 'desc' },
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
    } catch (error) {
      console.error('Search vendors error:', error)
    }

    try {
      const productCategories = await getPrisma().productCategory.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: { _count: { select: { products: true } } },
        take: 5,
        orderBy: { name: 'asc' },
      })

      results.categories = productCategories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: c._count?.products || 0,
        type: 'product-category',
      }))
    } catch (error) {
      console.error('Search categories error:', error)
    }

    try {
      const brands = await getPrisma().product.findMany({
        where: { brand: { not: null, contains: query, mode: 'insensitive' } },
        select: { brand: true },
        distinct: ['brand'],
        take: 5,
      })

      results.brands = brands
        .filter((b) => b.brand)
        .map((b) => ({ name: b.brand!, type: 'brand' }))
    } catch (error) {
      console.error('Search brands error:', error)
    }

    try {
      const suggestions = await getPrisma().searchSuggestion.findMany({
        where: { query: { contains: query, mode: 'insensitive' } },
        orderBy: { popularity: 'desc' },
        take: 5,
        select: { query: true, type: true },
      })

      results.suggestions = suggestions
    } catch (error) {
      console.error('Search suggestions error:', error)
    }

    const total = results.products.length + results.services.length + results.vendors.length + results.categories.length + results.brands.length + results.suggestions.length

    return NextResponse.json({ query, results, total })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}