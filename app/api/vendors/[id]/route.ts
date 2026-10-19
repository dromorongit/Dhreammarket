import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { PaymentStatus } from '@prisma/client'
import { countAttributableVendorCancelledOrders, vendorRejectedOrdersWhere } from '@/lib/trust-metrics'
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
    const followerCount = await getPrisma().vendorFollow.count({ where: { vendorId: actualStoreId } })

    let completedOrderCount: number | null = null
    let productVerifiedCount: number | null = null
    let vendorVerifiedCount: number | null = null
    let vendorCancelledCountValue: number | null = null

    const settled = await Promise.allSettled([
      getPrisma().order.count({
        where: {
          paymentStatus: 'PAID',
          status: { in: ['DELIVERED', 'COMPLETED'] },
          source: 'ONLINE',
          items: {
            some: {
              product: {
                storeId: actualStoreId,
              },
            },
          },
        },
      }),
      getPrisma().productReview.count({
        where: {
          product: {
            storeId: actualStoreId,
          },
          orderId: { not: null },
        },
      }),
      getPrisma().vendorReview.count({
        where: {
          storeId: actualStoreId,
          orderId: { not: null },
        },
      }),
      (async () => {
        // A rejected order used to be written to paymentStatus REFUNDED on
        // the spot, so it left the PAID bucket and the cancellation count was
        // effectively zero. The refund is now settled by the pipeline, so a
        // rejected order can sit in EITHER state: PAID while the refund
        // request is pending, or REFUNDED once it has been paid back. Both
        // count, exactly once, and the single-store attribution rule below is
        // unchanged.
        const rejectedWhere = vendorRejectedOrdersWhere(actualStoreId)
        const [orders, orderItems, products] = await Promise.all([
          getPrisma().order.findMany({
            where: rejectedWhere,
            select: {
              id: true,
              paymentStatus: true,
              vendorRejected: true,
              items: {
                select: {
                  product: {
                    select: {
                      storeId: true,
                    },
                  },
                },
              },
            },
          }),
          getPrisma().orderItem.findMany({
            where: {
              order: rejectedWhere,
            },
            select: {
              orderId: true,
              productId: true,
            },
          }),
          getPrisma().product.findMany({
            select: {
              id: true,
              storeId: true,
            },
          }),
        ])
        return countAttributableVendorCancelledOrders(orders, orderItems, products, actualStoreId)
      })(),
    ])

    if (settled[0].status === 'fulfilled') {
      completedOrderCount = settled[0].value
    } else {
      console.error('Failed to compute completed order count:', settled[0].reason)
    }

    if (settled[1].status === 'fulfilled') {
      productVerifiedCount = settled[1].value
    } else {
      console.error('Failed to compute product verified review count:', settled[1].reason)
    }

    if (settled[2].status === 'fulfilled') {
      vendorVerifiedCount = settled[2].value
    } else {
      console.error('Failed to compute vendor verified review count:', settled[2].reason)
    }

    if (settled[3].status === 'fulfilled') {
      vendorCancelledCountValue = settled[3].value
    } else {
      console.error('Failed to compute vendor cancelled count:', settled[3].reason)
    }

    const safeCompletedOrderCount = completedOrderCount ?? 0
    const safeVendorCancelledCount = vendorCancelledCountValue ?? 0
    const totalCompletedOrCancelled = safeCompletedOrderCount + safeVendorCancelledCount
    const vendorCancellationRate =
      completedOrderCount === null || vendorCancelledCountValue === null
        ? null
        : totalCompletedOrCancelled >= 10
          ? safeVendorCancelledCount / totalCompletedOrCancelled
          : null
    const isNewSeller = totalCompletedOrCancelled < 10

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
      followerCount,
      createdAt: store.createdAt,
      memberSince: store.createdAt,
      completedOrders: completedOrderCount,
      vendorCancelledCount: safeVendorCancelledCount,
      vendorCancellationRate,
      isNewSeller,
      verifiedPurchaseReviewCount: (productVerifiedCount ?? 0) + (vendorVerifiedCount ?? 0),
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
