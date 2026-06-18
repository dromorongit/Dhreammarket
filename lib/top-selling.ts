import type { PrismaClient } from '@prisma/client'

const productSelect = {
  id: true,
  name: true,
  price: true,
  flashSalePrice: true,
  flashSaleStart: true,
  flashSaleEnd: true,
  salesPrice: true,
  dealsPrice: true,
  stock: true,
  salesCount: true,
  isSponsored: true,
  brand: true,
  availabilityType: true,
  expectedArrivalDate: true,
  estimatedFulfillmentDays: true,
  preOrderNotes: true,
  expectedRestockDate: true,
  backOrderNotes: true,
  images: { select: { id: true, url: true, alt: true } },
  category: { select: { id: true, name: true, slug: true } },
  store: {
    select: { id: true, name: true, isVerified: true, logo: true, badgeTier: true },
  },
}

const VALID_ORDER_STATUSES = ['COMPLETED', 'DELIVERED'] as const

export async function getTopSellingProducts(prisma: PrismaClient, limit = 20) {
  try {
    const salesAggregates = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          status: { in: [...VALID_ORDER_STATUSES] },
          paymentStatus: 'PAID',
          deletedAt: null,
        },
      },
      _sum: { quantity: true },
      _count: { orderId: true },
      orderBy: [{ _sum: { quantity: 'desc' } }, { _count: { orderId: 'desc' } }],
      take: limit * 2,
    })

    if (salesAggregates.length === 0) {
      return []
    }

    const salesByProductId = new Map(
      salesAggregates.map((row: any) => [
        row.productId,
        {
          quantitySold: row._sum.quantity ?? 0,
          orderCount: row._count.orderId,
        },
      ])
    )

    const productIds = salesAggregates.map((row: any) => row.productId)

    let products: any[] = []
    try {
      products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          OR: [
            { stock: { gt: 0 } },
            { availabilityType: 'PREORDER' },
            { availabilityType: 'BACKORDER' },
          ],
        },
        select: productSelect,
      })
      console.log('[getTopSellingProducts] product.findMany succeeded, count:', products.length)
    } catch (e) {
      console.error('[getTopSellingProducts] product.findMany FAILED:', e)
      return []
    }

    const productMap = new Map(products.map((p) => [p.id, p]))

    return productIds
      .map((id) => {
        const product = productMap.get(id)
        if (!product) return null
        const stats = salesByProductId.get(id)
        return {
          ...product,
          salesCount: stats?.quantitySold ?? 0,
          orderFrequency: stats?.orderCount ?? 0,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p != null)
      .slice(0, limit)
  } catch (e) {
    console.error('[getTopSellingProducts] Overall error:', e)
    return []
  }
}
