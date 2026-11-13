import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { getCachedSellerTrustProfile } from '@/lib/trust/cached-profile'
import { composeProfile } from '@/lib/trust/metrics'
import { rehydrateProfileInput } from '@/lib/trust/rehydrate'
import type { SellerTrustProfile } from '@/lib/trust/types'
import {
  PUBLIC_PRODUCT_IMAGE_SELECT,
  PUBLIC_PRODUCT_SELECT,
} from '@/lib/public-selects'

// The storefront product shape. Every field is selected on purpose so the
// vendor's cost price never reaches a visitor.
const STOREFRONT_PRODUCT_SELECT = {
  ...PUBLIC_PRODUCT_SELECT,
  images: { select: PUBLIC_PRODUCT_IMAGE_SELECT },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  _count: {
    select: { productReviews: true },
  },
}

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
          select: STOREFRONT_PRODUCT_SELECT,
          orderBy: { createdAt: 'desc' },
        },
        services: {
          where: {
            status: 'PUBLISHED',            isActive: true,
          },
          select: {
            id: true,
            slug: true,
            title: true,
            shortDescription: true,
            description: true,
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
            select: STOREFRONT_PRODUCT_SELECT,
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
              description: true,
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

    // Seller metrics are computed by lib/trust (composeProfile) and exposed via
    // /api/trust/sellers/[storeId]. This route reuses the same profile so the
    // vendor API and the trust API return identical numbers.
    let trustProfile: SellerTrustProfile | null = null
    try {
      const loaded = await getCachedSellerTrustProfile(actualStoreId)
      if (loaded.found) {
        trustProfile = composeProfile(rehydrateProfileInput(loaded.data))
      }
    } catch (err) {
      console.error('Failed to load seller trust profile:', err)
    }

    const followerCount = await getPrisma().vendorFollow.count({ where: { vendorId: actualStoreId } })

    const ratingsValue = trustProfile?.ratings.value
    const cancellationSignal = trustProfile?.cancellation

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
      badgeTier: store.isVerified ? store.badgeTier : null,
      logo: store.logo,
      banner: store.banner,
      rating: Math.round((ratingsValue?.average ?? 0) * 10) / 10,
      totalReviews: ratingsValue?.count ?? 0,
      followerCount,
      createdAt: store.createdAt,
      memberSince: store.createdAt,
      completedOrders: trustProfile?.orders.completed ?? 0,
      vendorCancelledCount: cancellationSignal?.counts?.numerator ?? 0,
      vendorCancellationRate:
        cancellationSignal?.state === 'OK' && cancellationSignal.value
          ? cancellationSignal.value.percentage / 100
          : null,
      isNewSeller: trustProfile?.fulfilment.state === 'INSUFFICIENT_DATA',
      verifiedPurchaseReviewCount: ratingsValue?.count ?? 0,
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
           isReturnable: p.isReturnable,
         })),
        services: store.services
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
