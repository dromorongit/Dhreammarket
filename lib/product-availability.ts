import { getPrisma } from '@/lib/prisma'

export async function checkAndUpdateExpiredPreOrders(productIds: string[]): Promise<Set<string>> {
  if (!productIds || productIds.length === 0) return new Set()

  const now = new Date()

  const expiredProducts = await getPrisma().product.findMany({
    where: {
      id: { in: productIds },
      availabilityType: 'PREORDER',
      expectedArrivalDate: { lt: now },
    },
    select: { id: true },
  })

  const expiredIds = expiredProducts.map((p) => p.id)

  if (expiredIds.length === 0) return new Set()

  void getPrisma().product.updateMany({
    where: { id: { in: expiredIds } },
    data: {
      availabilityType: 'IN_STOCK',
      expectedArrivalDate: null,
    },
  }).catch((err) => {
    console.error('Failed to update expired pre-orders:', err)
  })

  return new Set(expiredIds)
}

export function isPreOrderExpired(
  availabilityType: string | null,
  expectedArrivalDate: string | Date | null
): boolean {
  if (availabilityType !== 'PREORDER') return false
  if (!expectedArrivalDate) return false
  const date = expectedArrivalDate instanceof Date ? expectedArrivalDate : new Date(expectedArrivalDate)
  return date < new Date()
}