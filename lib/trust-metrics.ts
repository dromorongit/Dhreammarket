export function countAttributableVendorCancelledOrders(
  orders: any[],
  orderItems: any[],
  products: any[],
  storeId: string
): number {
  const rejectedPaidOrderIds = new Set(
    orders
      .filter(o => o.paymentStatus === 'PAID' && o.vendorRejected === true)
      .map(o => o.id)
  )

  if (rejectedPaidOrderIds.size === 0) {
    return 0
  }

  const orderVendorMap = new Map<string, Set<string>>()
  for (const item of orderItems) {
    if (!rejectedPaidOrderIds.has(item.orderId)) continue
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
