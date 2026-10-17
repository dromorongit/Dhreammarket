import { OrderSource, PaymentStatus } from '@prisma/client'

/**
 * Count the cancellations a store is responsible for.
 *
 * A vendor rejection is a cancellation the customer did not ask for, so it is
 * the store's cancellation and it goes into the storefront cancellation rate.
 *
 * The state rule: a rejected order leaves its refund going through the
 * pipeline, so it can legitimately sit in EITHER payment state - PAID while
 * the refund request is still pending, or REFUNDED once the money has gone
 * back. Both count. Filtering on PAID alone under-counted every order whose
 * refund had already been settled.
 *
 * The attribution rule: an order is only attributable to this store when every
 * one of its items belongs to this store, so a multi-store order is excluded
 * rather than charged to whichever store happens to share it.
 */
export function countAttributableVendorCancelledOrders(
  orders: any[],
  orderItems: any[],
  products: any[],
  storeId: string
): number {
  const rejectedOrderIds = new Set(
    orders
      .filter(o => o.vendorRejected === true)
      .filter(o => o.paymentStatus === 'PAID' || o.paymentStatus === 'REFUNDED')
      .map(o => o.id)
  )

  if (rejectedOrderIds.size === 0) {
    return 0
  }

  const orderVendorMap = new Map<string, Set<string>>()
  for (const item of orderItems) {
    if (!rejectedOrderIds.has(item.orderId)) continue
    const product = products.find(p => p.id === item.productId)
    if (!product) continue
    const itemStoreId = product.storeId
    if (!orderVendorMap.has(item.orderId)) {
      orderVendorMap.set(item.orderId, new Set())
    }
    orderVendorMap.get(item.orderId)!.add(itemStoreId)
  }

  let attributableCount = 0
  const entries = Array.from(orderVendorMap.entries())
  for (const [orderId, vendorSet] of entries) {
    if (vendorSet.size === 1 && vendorSet.has(storeId)) {
      attributableCount++
    }
  }

  return attributableCount
}

/**
 * Prisma where clause for vendor-rejected orders attributable to a store.
 *
 * Includes:
 * - vendorRejected: true
 * - paymentStatus in ['PAID', 'REFUNDED'] (covers both pending and settled refunds)
 * - items.some.product.storeId = storeId (the store has at least one item)
 * - items.every.product.storeId = storeId (all items belong to this store; excludes multi-store orders)
 */
export function vendorRejectedOrdersWhere(storeId: string) {
  return {
    vendorRejected: true,
    paymentStatus: { in: ['PAID', 'REFUNDED'] as PaymentStatus[] },
    source: OrderSource.ONLINE,
    items: {
      some: {
        product: {
          storeId,
        },
      },
      every: {
        product: {
          storeId,
        },
      },
    },
  }
}
