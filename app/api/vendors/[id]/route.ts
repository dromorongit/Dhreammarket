import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Try to find by slug first, then by id
    let store = await getPrisma().store.findUnique({
      where: { slug: params.id },
      include: {
          user: {
            select: {
              id: true,
              profile: { select: { firstName: true, lastName: true, avatar: true } },
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
          where: {
            OR: [
              { stock: { gt: 0 } },
              { availabilityType: 'PREORDER' },
              { availabilityType: 'BACKORDER' },
            ],
          },
          include: {
            images: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: { productReviews: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        services: {
          where: {
            status: 'PUBLISHED',
            isActive: true,
          },
          select: {
            id: true,
            slug: true,
            title: true,
            shortDescription: true,
            startingPrice: true,
            pricingType: true,
            thumbnail: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: {
          select: { products: true },
        },
      },
    })

    // Fallback to id lookup if slug not found
    if (!store) {
      store = await getPrisma().store.findUnique({
        where: { id: params.id },
        include: {
          user: {
            select: {
              id: true,
              profile: { select: { firstName: true, lastName: true, avatar: true } },
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
            where: {
              OR: [
                { stock: { gt: 0 } },
                { availabilityType: 'PREORDER' },
                { availabilityType: 'BACKORDER' },
              ],
            },
            include: {
              images: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
              _count: {
                select: { productReviews: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          services: {
            where: {
              status: 'PUBLISHED',
              isActive: true,
            },
            select: {
              id: true,
              slug: true,
              title: true,
              shortDescription: true,
              startingPrice: true,
              pricingType: true,
              thumbnail: true,
              category: { select: { id: true, name: true, slug: true } },
            },
          },
          _count: {
            select: { products: true },
          },
        },
      })
    }

    if (!store) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Check if vendor has completed onboarding (has a vendor category assigned)
    if (!store.categoryId) {
      return NextResponse.json({ error: 'Vendor profile not available' }, { status: 404 })
    }

    const actualStoreId = store.id

    // Calculate average rating from vendor reviews
    const allReviews = await getPrisma().vendorReview.findMany({
      where: {
        storeId: actualStoreId,
      },
      select: {
        rating: true,
      },
    })

    const averageRating = allReviews.length > 0
      ? allReviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / allReviews.length
      : 0

    const totalReviews = allReviews.length

    // Check if featured status is still valid
    const isCurrentlyFeatured = store.isFeatured && 
      store.featuredUntil && 
      new Date(store.featuredUntil) > new Date()

 const vendorData = {
      slug: store.slug,
      id: store.id,
      name: store.name,
      description: store.description,
      isVerified: store.isVerified,
      isFeatured: isCurrentlyFeatured,
      badgeTier: store.badgeTier,
      logo: store.logo,
      banner: store.banner,
      rating: Math.round(averageRating * 10) / 10,
      totalReviews,
      createdAt: store.createdAt,
      category: store.vendor_categories,
      mainPhoneNumber: store.mainPhoneNumber,
      alternativePhoneNumber: store.alternativePhoneNumber,
      whatsappNumber: store.whatsappNumber,
      location: store.location,
      products: store.products.map((p: any) => ({
         id: p.id,
         slug: p.slug,
         name: p.name,
         description: p.description,
         price: p.price,
         flashSalePrice: p.flashSalePrice,
         salesPrice: p.salesPrice,
         dealsPrice: p.dealsPrice,
         stock: p.stock,
         images: p.images,
         category: p.category,
         reviewCount: p._count.productReviews,
         availabilityType: p.availabilityType,
         expectedArrivalDate: p.expectedArrivalDate,
         estimatedFulfillmentDays: p.estimatedFulfillmentDays,
         preOrderNotes: p.preOrderNotes,
         expectedRestockDate: p.expectedRestockDate,
         backOrderNotes: p.backOrderNotes,
       })),
       services: store.services
         .filter((s: any) => s.status === 'PUBLISHED' && s.isActive)
         .map((s: any) => ({
           id: s.id,
           slug: s.slug,
           title: s.title,
           shortDescription: s.shortDescription,
           description: s.description,
           startingPrice: s.startingPrice,
           pricingType: s.pricingType,
           thumbnail: s.thumbnail,
           category: s.category,
         })),
       productCount: store._count.products,
     }

// Check if this was found by id lookup (meaning old CUID URL) and redirect to slug
    const isIdLookup = !await getPrisma().store.findUnique({
      where: { slug: params.id },
      select: { id: true },
    })
    if (isIdLookup && store.slug) {
      return NextResponse.redirect(new URL(`/vendor/${store.slug}`, request.url))
    }

    return NextResponse.json({ vendor: vendorData })
  } catch (error) {
    console.error('Vendor profile error:', error)
    return NextResponse.json({ error: 'Failed to fetch vendor profile' }, { status: 500 })
  }
}