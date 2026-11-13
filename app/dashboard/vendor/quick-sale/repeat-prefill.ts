export interface RepeatOrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

export interface RepeatProduct {
  id: string
  name: string
  price: number
  availableStock: number
}

export interface RepeatCartLine {
  productId: string
  variantId: string | null
  name: string
  variantLabel: string | null
  quantity: number
  unitPrice: number
  overridden: boolean
}

export interface RepeatPrefillResult {
  lines: RepeatCartLine[]
  skipped: string[]
}

/**
 * Build cart lines from a customer's last ordered items using CURRENT product
 * prices and stock. Products that are deleted or out of stock are skipped and
 * listed in `skipped` so the seller can review before confirming. Nothing is
 * saved here - the caller decides when (or whether) to submit the cart.
 */
export function buildRepeatLines(
  lastOrderedItems: RepeatOrderItem[],
  products: RepeatProduct[],
): RepeatPrefillResult {
  const lines: RepeatCartLine[] = []
  const skipped: string[] = []

  for (const item of lastOrderedItems) {
    const product = products.find((p) => p.id === item.productId)
    // Deleted or out-of-stock products cannot be repeated.
    if (!product || product.availableStock <= 0) {
      skipped.push(item.productName)
      continue
    }

    lines.push({
      productId: product.id,
      variantId: null,
      name: product.name,
      variantLabel: null,
      quantity: item.quantity,
      unitPrice: product.price,
      overridden: false,
    })
  }

  return { lines, skipped }
}
