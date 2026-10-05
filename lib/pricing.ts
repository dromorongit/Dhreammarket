export function getUnitPrice(
  product: { price: number; dealsPrice?: number | null; salesPrice?: number | null },
  variant?: { price?: number | null } | null
): number {
  if (variant?.price != null) {
    return variant.price
  }
  if (product.dealsPrice != null && product.dealsPrice > 0 && product.dealsPrice < product.price) {
    return product.dealsPrice
  }
  if (product.salesPrice != null && product.salesPrice > 0 && product.salesPrice < product.price) {
    return product.salesPrice
  }
  return product.price
}
