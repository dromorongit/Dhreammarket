import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

const prisma = getPrisma()

export const dynamic = 'force-dynamic'

const LIMIT_PER_TYPE = 5

export async function GET(request: NextRequest) {
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
      categories: [],
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
          store: { select: { id: true, name: true, isVerified: true } },
          category: { select: { id: true, name: true } },
        },
        take: typeFilter === 'products' ? 20 : LIMIT_PER_TYPE,
        orderBy: { createdAt: 'desc' },
      })

      results.products = products.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        stock: p.stock,
        image: p.images[0]?.url || null,
        store: p.store,
        category: p.category,
        type: 'product',
      }))
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
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { products: true } },
        },
        take: LIMIT_PER_TYPE,
        orderBy: { createdAt: 'desc' },
      })

      results.vendors = vendors.map((v) => ({
        id: v.id,
        name: v.name,
        description: v.description,
        logo: v.logo,
        isVerified: v.isVerified,
        isFeatured: v.isFeatured,
        productCount: v._count.products,
        category: v.category,
        type: 'vendor',
      }))
    }

    // Search Categories
    if (!typeFilter || typeFilter === 'categories') {
      const categories = await prisma.category.findMany({
        where: {
          name: { contains: query, mode: 'insensitive' },
        },
        include: {
          _count: { select: { products: true } },
        },
        take: LIMIT_PER_TYPE,
        orderBy: { name: 'asc' },
      })

      results.categories = categories.map((c) => ({
        id: c.id,
        name: c.name,
        productCount: c._count.products,
        type: 'category',
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
        brandCounts.map((b) => [b.brand!.toLowerCase(), b._count.id])
      )

      results.brands = allProducts
        .filter((p) => p.brand)
        .map((p) => ({
          name: p.brand!,
          productCount: brandCountMap.get(p.brand!.toLowerCase()) || 0,
          type: 'brand',
        }))
    }

    const total = results.products.length + results.vendors.length + results.categories.length + results.brands.length

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
