// The one definition of what a commerce row looks like when it leaves the
// server for anybody who is NOT the vendor who owns the store.
//
// Four fields are business secrets and must never travel that way:
//
//   * Product.costPrice        - what the vendor paid for the stock
//   * ProductVariant.costPrice - the same, per variant
//   * OrderItem.costPriceSnapshot - what the line cost when it was sold
//   * Order.deliveryCost       - what the vendor paid the rider
//
// A Prisma `include` returns EVERY column of the included row, so
// `include: { variants: true }` silently ships the cost price to every
// buyer. That is why every public route in this app selects its fields
// explicitly from the constants below instead of using `include`.
//
// Vendor-scoped routes are deliberately not built from these: a vendor is
// entitled to their own cost prices, so those routes select the cost fields
// on purpose AND scope the query to the vendor's own store.
//
// If you add a column to a model, decide here whether it is public. If it is
// not, it does not go into these selects.

/**
 * The public shape of a product variant.
 *
 * `costPrice` is deliberately absent.
 */
export const PUBLIC_VARIANT_SELECT = {
  id: true,
  color: true,
  size: true,
  age: true,
  sku: true,
  price: true,
  stock: true,
  reservedQuantity: true,
  active: true,
} as const

/**
 * The public shape of a product.
 *
 * `costPrice` is deliberately absent.
 */
export const PUBLIC_PRODUCT_SELECT = {
  id: true,
  slug: true,
  storeId: true,
  categoryId: true,
  name: true,
  description: true,
  brand: true,
  brandId: true,
  price: true,
  stock: true,
  reservedQuantity: true,
  lowStockThreshold: true,
  averageRating: true,
  reviewCount: true,
  flashSalePrice: true,
  flashSaleStart: true,
  flashSaleEnd: true,
  salesCount: true,
  isSponsored: true,
  dealsPrice: true,
  dealsStart: true,
  dealsEnd: true,
  salesPrice: true,
  availabilityType: true,
  expectedArrivalDate: true,
  estimatedFulfillmentDays: true,
  preOrderNotes: true,
  expectedRestockDate: true,
  backOrderNotes: true,
  isReturnable: true,
} as const

/**
 * The public shape of a product image.
 */
export const PUBLIC_PRODUCT_IMAGE_SELECT = {
  id: true,
  url: true,
  alt: true,
  mediaType: true,
} as const

/**
 * The public shape of a sold line, as a BUYER sees it.
 *
 * `costPriceSnapshot` is deliberately absent, and so are the platform money
 * split columns (grossAmount, processorFee, netAmount, platformCommission,
 * vendorEarnings, commissionRate): those describe how the platform splits
 * the money and are none of a buyer's business.
 */
export const PUBLIC_ORDER_ITEM_SELECT = {
  id: true,
  orderId: true,
  productId: true,
  productVariantId: true,
  quantity: true,
  price: true,
  createdAt: true,
  age: true,
  color: true,
  size: true,
  availabilityType: true,
  expectedArrivalDate: true,
  expectedRestockDate: true,
  allocatedQuantity: true,
  shippedAt: true,
  deliveredAt: true,
  deliveryConfirmedAt: true,
  deliveryConfirmedBy: true,
} as const

/**
 * The public shape of an order, as a BUYER sees it.
 *
 * `deliveryCost` is deliberately absent: it is what the vendor paid the
 * rider, not what the buyer paid.
 */
export const PUBLIC_ORDER_SELECT = {
  id: true,
  userId: true,
  total: true,
  subtotal: true,
  tax: true,
  shipping: true,
  status: true,
  paymentStatus: true,
  vendorAccepted: true,
  vendorRejected: true,
  vendorRejectionReason: true,
  createdAt: true,
  updatedAt: true,
  customerAddress: true,
  customerCity: true,
  customerEmail: true,
  customerFirstName: true,
  customerLastName: true,
  customerPhone: true,
  customerRegion: true,
  shippingZone: true,
  shippingDaysMin: true,
  shippingDaysMax: true,
  orderType: true,
  fulfillmentStatus: true,
  paymentConfirmedAt: true,
  source: true,
  channel: true,
  paymentMethod: true,
  receiptToken: true,
  vendorCustomerId: true,
} as const

/**
 * The order shape a VENDOR sees.
 *
 * Same as the buyer's shape, plus the loyalty wallet offset that is already
 * shown on the vendor order screen. The order level `deliveryCost` is NOT
 * here: on a shared order it belongs to another vendor, and on an online
 * order it is the platform's delivery bill. Vendor routes add it back only
 * for their own manual orders.
 */
export const VENDOR_ORDER_SELECT = {
  ...PUBLIC_ORDER_SELECT,
  walletAmountApplied: true,
} as const

/**
 * The sold-line shape a VENDOR sees.
 *
 * A vendor is entitled to the cost snapshot of their own lines: it is what
 * their profit is computed from.
 */
export const VENDOR_ORDER_ITEM_SELECT = {
  ...PUBLIC_ORDER_ITEM_SELECT,
  costPriceSnapshot: true,
} as const

/**
 * The field names that must never appear in a public payload.
 *
 * Used by the leak tests so that one list drives every assertion.
 */
export const FORBIDDEN_PUBLIC_FIELDS = [
  'costPrice',
  'costPriceSnapshot',
  'deliveryCost',
] as const

/**
 * Walk any JSON-ish value and collect the forbidden field names it carries,
 * at any depth. `variantCostPrice` and `productCostPrice` are included
 * because they are the same secret under another name.
 */
export function findForbiddenCostFields(value: unknown): string[] {
  const found = new Set<string>()

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const entry of node) visit(entry)
      return
    }
    if (!node || typeof node !== 'object') return

    for (const [key, entry] of Object.entries(node as Record<string, unknown>)) {
      if (
        (FORBIDDEN_PUBLIC_FIELDS as readonly string[]).includes(key) ||
        key === 'variantCostPrice' ||
        key === 'productCostPrice'
      ) {
        found.add(key)
      }
      visit(entry)
    }
  }

  visit(value)
  return Array.from(found)
}
