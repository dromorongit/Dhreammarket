import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const storeId = params.id

    // Fetch store with all related data
    const store = await getPrisma().store.findUnique({
      where: { id: storeId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
        vendor_categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        products: {
          where: { stock: { gt: 0 } },
          include: {
            images: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: { reviews: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { products: true },
        },
      },
    })

    if (!store) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Check if vendor has completed onboarding (has a vendor category assigned)
    if (!store.categoryId) {
      return NextResponse.json({ error: 'Vendor profile not available' }, { status: 404 })
    }

    // Calculate average rating from products
    const allReviews = await getPrisma().review.findMany({
      where: {
        product: {
          storeId: storeId,
        },
      },
      select: {
        rating: true,
      },
    })

    const averageRating = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0

    const totalReviews = allReviews.length

    // Check if featured status is still valid
    const isCurrentlyFeatured = store.isFeatured && 
      store.featuredUntil && 
      new Date(store.featuredUntil) > new Date()

    const vendorData = {
      id: store.id,
      name: store.name,
      description: store.description,
      mainPhoneNumber: store.mainPhoneNumber,
      alternativePhoneNumber: store.alternativePhoneNumber,
      whatsappNumber: store.whatsappNumber,
      isVerified: store.isVerified,
      isFeatured: isCurrentlyFeatured,
      logo: store.logo,
      banner: store.banner,
      rating: Math.round(averageRating * 10) / 10,
      totalReviews,
      createdAt: store.createdAt,
      category: store.vendor_categories,
      products: store.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        images: p.images,
        category: p.category,
        reviewCount: p._count.reviews,
      })),
      productCount: store._count.products,
    }

    return NextResponse.json({ vendor: vendorData })
  } catch (error) {
    console.error('Vendor profile error:', error)
    return NextResponse.json({ error: 'Failed to fetch vendor profile' }, { status: 500 })
  }
}