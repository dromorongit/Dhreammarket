import { vendorRejectedOrdersWhere } from '@/lib/trust-metrics'
import { ROLLING_WINDOW_DAYS } from './constants'
import type { TrustProfileInput } from './types'

export type LoadResult = { found: false } | { found: true; data: TrustProfileInput }

export async function loadSellerTrustProfile(
  client: any,
  { storeId, now }: { storeId: string; now: Date }
): Promise<LoadResult> {
  const storeSelect = {
    id: true,
    createdAt: true,
    userId: true,
    isVerified: true,
    updatedAt: true,
    verificationApplications: {
      where: { status: 'APPROVED' },
      orderBy: { updatedAt: 'desc' },
      take: 1,
      select: { status: true, updatedAt: true },
    },
  }

  let store = await client.store.findUnique({ where: { slug: storeId }, select: storeSelect })
  if (!store) {
    store = await client.store.findUnique({ where: { id: storeId }, select: storeSelect })
  }
  if (!store) return { found: false }

  const actualId = store.id
  const windowStart = new Date(now.getTime() - ROLLING_WINDOW_DAYS * 86400000)

  const approvedApp = Array.isArray(store.verificationApplications)
    ? store.verificationApplications[0]
    : null
  const verificationStatus = store.isVerified || approvedApp ? 'VERIFIED' : 'UNVERIFIED'
  const verifiedSince = approvedApp?.updatedAt ?? (store.isVerified ? store.updatedAt : null)

  const completedBase = {
    paymentStatus: 'PAID',
    status: { in: ['DELIVERED', 'COMPLETED'] },
    source: 'ONLINE',
    items: { some: { product: { storeId: actualId } } },
  }
  const completedInWindow = await client.order.count({
    where: { ...completedBase, createdAt: { gte: windowStart } },
  })
  const completedLifetime = await client.order.count({ where: completedBase })

  const cancelledWhere = {
    ...vendorRejectedOrdersWhere(actualId),
    createdAt: { gte: windowStart },
  }
  const vendorCancelledInWindow = await client.order.count({ where: cancelledWhere })

  const deliveryItems = await client.orderItem.findMany({
    where: {
      deliveredAt: { not: null, gte: windowStart },
      order: { paymentStatus: 'PAID', source: 'ONLINE' },
      product: { storeId: actualId },
    },
    select: {
      deliveredAt: true,
      order: { select: { paymentConfirmedAt: true, createdAt: true } },
    },
    orderBy: { deliveredAt: 'desc' },
    take: 5000,
  })
  const deliveryDays = (deliveryItems ?? [])
    .map((it: any) => {
      const start = it?.order?.paymentConfirmedAt ?? it?.order?.createdAt
      const end = it?.deliveredAt
      if (!start || !end) return null
      const ms = new Date(end).getTime() - new Date(start).getTime()
      return ms < 0 ? 0 : ms / 86400000
    })
    .filter((n: any) => n !== null)

  const sellerFaultReturnsInWindow = await client.returnRequest.count({
    where: {
      reason: { in: ['NOT_AS_DESCRIBED', 'DAMAGED', 'WRONG_ITEM', 'NOT_RECEIVED'] },
      status: { in: ['AWAITING_REFUND', 'CLOSED'] },
      createdAt: { gte: windowStart },
      orderItem: { product: { storeId: actualId } },
    },
  })

  const firstOrder = await client.order.findFirst({
    where: {
      paymentStatus: 'PAID',
      source: 'ONLINE',
      items: { some: { product: { storeId: actualId } } },
    },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  })
  const firstSaleAt = firstOrder?.createdAt ?? null

  const productAgg = await client.productReview.aggregate({
    where: {
      isApproved: true,
      isHidden: false,
      userId: { not: store.userId },
      orderId: { not: null },
      product: { storeId: actualId },
      order: { paymentStatus: 'PAID', status: { in: ['DELIVERED', 'COMPLETED'] } },
    },
    _count: { _all: true },
    _sum: { rating: true },
  })
  const vendorAgg = await client.vendorReview.aggregate({
    where: {
      isApproved: true,
      isHidden: false,
      userId: { not: store.userId },
      orderId: { not: null },
      storeId: actualId,
      order: { paymentStatus: 'PAID', status: { in: ['DELIVERED', 'COMPLETED'] } },
    },
    _count: { _all: true },
    _sum: { rating: true },
  })
  const reviewCount =
    (productAgg?._count?._all ?? 0) + (vendorAgg?._count?._all ?? 0)
  const reviewSum =
    (productAgg?._sum?.rating ?? 0) + (vendorAgg?._sum?.rating ?? 0)

  const data: TrustProfileInput = {
    storeCreatedAt: store.createdAt,
    firstSaleAt,
    verificationStatus: verificationStatus as any,
    verifiedSince,
    now,
    windowDays: ROLLING_WINDOW_DAYS,
    completedInWindow,
    completedLifetime,
    vendorCancelledInWindow,
    deliveryDays,
    sellerFaultReturnsInWindow,
    reviewCount,
    reviewSum,
  }
  return { found: true, data }
}
