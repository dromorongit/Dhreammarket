import { getPrisma } from './prisma'

/**
 * Recalculate and update the cached average rating and review count for a product
 * Called after review creation, update, or deletion
 */
export async function syncProductRating(productId: string): Promise<void> {
  const prisma = getPrisma()
  await prisma.$transaction(async (tx) => {
    const reviews = await tx.productReview.findMany({
      where: {
        productId,
        isApproved: true,
        isHidden: false,
      },
      select: {
        rating: true,
      },
    })

    const reviewCount = reviews.length
    const averageRating = reviewCount > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : 0

    await tx.product.update({
      where: { id: productId },
      data: {
        averageRating: parseFloat(averageRating.toFixed(1)),
        reviewCount,
      },
    })
  })
}

/**
 * Recalculate and update the cached average rating and review count for a store
 * Called after vendor review creation, update, or deletion
 */
export async function syncStoreRating(storeId: string): Promise<void> {
  const prisma = getPrisma()
  await prisma.$transaction(async (tx) => {
    const agg = await tx.vendorReview.aggregate({
      where: {
        storeId,
        isApproved: true,
        isHidden: false,
      },
      _count: { _all: true },
      _sum: { rating: true },
    })
    const reviewCount = agg?._count?._all ?? 0
    const ratingSum = agg?._sum?.rating ?? 0
    const averageRating = reviewCount > 0 ? ratingSum / reviewCount : 0
    await tx.store.update({
      where: { id: storeId },
      data: {
        averageRating: parseFloat(averageRating.toFixed(1)),
        reviewCount,
      },
    })
  })
}

/**
 * Recalculate and update the cached average rating and review count for a service
 * Called after service review creation, update, or deletion
 */
export async function syncServiceRating(serviceId: string): Promise<void> {
  const reviews = await getPrisma().serviceReview.findMany({
    where: {
      serviceId,
      isApproved: true,
      isHidden: false,
    },
    select: {
      rating: true,
    },
  })

  const reviewCount = reviews.length
  const averageRating = reviewCount > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    : 0

  await getPrisma().service.update({
    where: { id: serviceId },
    data: {
      averageRating: parseFloat(averageRating.toFixed(1)),
      reviewCount,
    },
  })
}