// Loads the raw rows the vendor money view needs, scoped to ONE store.
//
// The scoping rule is the one the rest of the vendor dashboard already uses:
// a vendor sees an order when the order holds at least one of THEIR
// products, and they only ever see their own line items. A cart that mixes
// two vendors' products is counted for each vendor, and only for their own
// lines.
//
// The loader returns plain data; every money decision is made by the pure
// functions in lib/sales-summary.ts.

import { getPrisma } from '@/lib/prisma'
import {
  accraDayEndExclusive,
  accraDayStart,
  type SalesSummaryItemInput,
  type SalesSummaryOrderInput,
  type SalesSummaryRefundInput,
} from '@/lib/sales-summary'

export interface VendorProductCostInfo {
  id: string
  name: string
  price: number
  costPrice: number | null
  variants: Array<{
    id: string
    label: string | null
    price: number | null
    costPrice: number | null
  }>
}

export interface MissingCostEntry {
  productId: string
  productName: string
  productVariantId: string | null
  variantLabel: string | null
  price: number
  costPrice: number | null
}
export interface VendorSalesData {
  orders: SalesSummaryOrderInput[]
  refunds: SalesSummaryRefundInput[]
  products: VendorProductCostInfo[]
  missingCost: MissingCostEntry[]
  missingCostProducts: number
  missingCostVariants: number
}

/**
 * How many orders are read per database round trip.
 *
 * The report process runs with a small heap, so the orders of a long period
 * are read in pages and folded into running totals instead of being held in
 * memory all at once.
 */
export const SALES_BATCH_SIZE = 500

/**
 * The most orders a single report may cover.
 *
 * Past this the report is refused with a 413 and the vendor is asked for a
 * shorter period, because a longer one would take the process down.
 */
export const MAX_ORDERS_PER_REPORT = 50_000
/**
 * The report covers too many orders to be served.
 */
export class SalesRangeTooLargeError extends Error {
  readonly count: number
  readonly limit: number

  constructor(count: number, limit: number = MAX_ORDERS_PER_REPORT) {
    super(`range too large, choose a shorter period (${count} orders, limit ${limit})`)
    this.name = 'SalesRangeTooLargeError'
    this.count = count
    this.limit = limit
  }
}

/**
 * A Prisma Decimal (or a plain number in tests) as a JS number.
 */
export function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const candidate = value as { toNumber?: () => number }
  if (typeof candidate.toNumber === 'function') {
    const parsed = candidate.toNumber()
    return Number.isFinite(parsed) ? parsed : 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * The human label of a variant: "Red / Large" and friends.
 */
export function variantLabel(variant: {
  color?: string | null
  size?: string | null
  age?: string | null
  sku?: string | null
}): string | null {
  const parts = [variant.color, variant.size, variant.age].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  )
  if (parts.length > 0) return parts.join(' / ')
  if (typeof variant.sku === 'string' && variant.sku.trim().length > 0) return variant.sku.trim()
  return null
}

/**
 * The name shown for the buyer of an order.
 *
 * A manual sale carries the customer name the vendor typed in. An online
 * sale carries the buyer's account, so the profile name is used and the
 * email is the fallback.
 */
export function resolveCustomerName(order: {
  customerFirstName?: string | null
  customerLastName?: string | null
  user?: {
    email?: string | null
    profile?: { firstName?: string | null; lastName?: string | null } | null
  } | null
}): string | null {
  const first = order.customerFirstName?.trim()
  const last = order.customerLastName?.trim()
  if (first || last) return [first, last].filter(Boolean).join(' ')

  const profile = order.user?.profile
  const profileFirst = profile?.firstName?.trim()
  const profileLast = profile?.lastName?.trim()
  if (profileFirst || profileLast) return [profileFirst, profileLast].filter(Boolean).join(' ')

  const email = order.user?.email?.trim()
  return email ? email : null
}

/**
 * How many of the vendor's cost slots are filled in.
 *
 * A "cost slot" is one thing that can hold a cost price: a product with no
 * variants has one, a product with variants has one per variant (a variant
 * without its own cost inherits the product's cost).
 */
export interface CostCoverage {
  total: number
  withCost: number
  missing: number
  percent: number
}

export function computeCostCoverage(products: VendorProductCostInfo[]): CostCoverage {
  let total = 0
  let withCost = 0

  for (const product of products) {
    const variants = product.variants || []
    if (variants.length === 0) {
      total += 1
      if (product.costPrice !== null && product.costPrice !== undefined) withCost += 1
      continue
    }
    for (const variant of variants) {
      total += 1
      const effective =
        variant.costPrice !== null && variant.costPrice !== undefined
          ? variant.costPrice
          : product.costPrice
      if (effective !== null && effective !== undefined) withCost += 1
    }
  }

  return {
    total,
    withCost,
    missing: total - withCost,
    percent: total === 0 ? 100 : Math.round((withCost / total) * 10000) / 100,
  }
}

/**
 * The products of a store that still need a cost price, and the count of
 * them. A variant that inherits a product-level cost is NOT missing one.
 */
export function findMissingCostEntries(
  products: VendorProductCostInfo[],
): MissingCostEntry[] {
  const missing: MissingCostEntry[] = []

  for (const product of products) {
    const variants = product.variants || []
    if (variants.length === 0) {
      if (product.costPrice === null || product.costPrice === undefined) {
        missing.push({
          productId: product.id,
          productName: product.name,
          productVariantId: null,
          variantLabel: null,
          price: product.price,
          costPrice: null,
        })
      }
      continue
    }

    for (const variant of variants) {
      const hasOwnCost = variant.costPrice !== null && variant.costPrice !== undefined
      const inheritsProductCost = product.costPrice !== null && product.costPrice !== undefined
      if (hasOwnCost || inheritsProductCost) continue
      missing.push({
        productId: product.id,
        productName: product.name,
        productVariantId: variant.id,
        variantLabel: variant.label,
        price: variant.price ?? product.price,
        costPrice: null,
      })
    }
  }

  return missing
}

/* -------------------------------------------------------------------------- */
/* Loading the report rows                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The orders of a store in a period, scoped by their line items.
 */
function vendorOrderWhere(storeId: string, from: Date, to: Date) {
  return {
    deletedAt: null,
    createdAt: { gte: accraDayStart(from), lt: accraDayEndExclusive(to) },
    items: { some: { product: { storeId } } },
  }
}

/**
 * The order columns the money view reads.
 *
 * The lines are scoped to the store, so a vendor only ever sees their own
 * line items and the order totals they are entitled to.
 */
function vendorSalesOrderSelect(storeId: string) {
  return {
    id: true,
    source: true,
    channel: true,
    status: true,
    paymentStatus: true,
    createdAt: true,
    total: true,
    vendorEarnings: true,
    netAmount: true,
    deliveryCost: true,
    customerFirstName: true,
    customerLastName: true,
    customerPhone: true,
    receiptToken: true,
    paymentMethod: true,
    items: {
      where: { product: { storeId } },
      select: {
        id: true,
        productId: true,
        productVariantId: true,
        quantity: true,
        price: true,
        costPriceSnapshot: true,
        vendorEarnings: true,
        product: { select: { id: true, name: true, costPrice: true } },
        productVariant: {
          select: { id: true, color: true, size: true, age: true, sku: true, costPrice: true },
        },
      },
    },
    user: {
      select: {
        email: true,
        profile: { select: { firstName: true, lastName: true } },
      },
    },
  }
}

/**
 * Map an order row to the shape the pure money functions read.
 */
export function toVendorOrderInput(order: any): SalesSummaryOrderInput {
  return {
    id: order.id,
    source: order.source,
    channel: order.channel ?? null,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    total: order.total,
    vendorEarnings: order.vendorEarnings ?? null,
    netAmount: order.netAmount ?? null,
    deliveryCost: order.deliveryCost ?? null,
    customerFirstName: order.customerFirstName ?? null,
    customerLastName: order.customerLastName ?? null,
    customerPhone: order.customerPhone ?? null,
    receiptToken: order.receiptToken ?? null,
    paymentMethod: order.paymentMethod ?? null,
    customerName: resolveCustomerName(order),
    items: (order.items || []).map((item: any): SalesSummaryItemInput => ({
      id: item.id,
      productId: item.productId,
      productVariantId: item.productVariantId ?? null,
      productName: item.product?.name ?? 'Unknown product',
      variantLabel: item.productVariant ? variantLabel(item.productVariant) : null,
      quantity: item.quantity,
      price: item.price,
      costPriceSnapshot: item.costPriceSnapshot ?? null,
      variantCostPrice: item.productVariant?.costPrice ?? null,
      productCostPrice: item.product?.costPrice ?? null,
      vendorEarnings: item.vendorEarnings ?? null,
    })),
  }
}

/**
 * One page of the store's orders, oldest first.
 *
 * `cursor` is the id of the last order of the previous page; null starts at
 * the beginning. The cursor walks the orders instead of skipping over them,
 * so a long report does not read the same rows over and over.
 */
export async function loadVendorOrderPage(
  storeId: string,
  from: Date,
  to: Date,
  cursor: string | null = null,
  batchSize: number = SALES_BATCH_SIZE,
): Promise<{ orders: SalesSummaryOrderInput[]; nextCursor: string | null }> {
  const prisma = getPrisma()

  const rows = await prisma.order.findMany({
    where: vendorOrderWhere(storeId, from, to),
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: batchSize,
    select: vendorSalesOrderSelect(storeId),
  })

  const orders = (rows as any[]).map(toVendorOrderInput)

  return {
    orders,
    // A full page may be followed by more rows; a partial page is the last one.
    nextCursor: orders.length === batchSize ? orders[orders.length - 1].id : null,
  }
}

/**
 * Walk the store's orders in the period, one page at a time.
 *
 * Nothing but the current page is held in memory, so a report over 50,000
 * orders costs the same heap as a report over 500.
 */
export async function* iterateVendorOrders(
  storeId: string,
  from: Date,
  to: Date,
  options: { batchSize?: number; maxOrders?: number } = {},
): AsyncGenerator<SalesSummaryOrderInput> {
  const batchSize = options.batchSize ?? SALES_BATCH_SIZE
  const maxOrders = options.maxOrders ?? MAX_ORDERS_PER_REPORT

  let cursor: string | null = null
  let seen = 0

  while (true) {
    const page = await loadVendorOrderPage(storeId, from, to, cursor, batchSize)
    if (page.orders.length === 0) break

    for (const order of page.orders) {
      seen += 1
      if (seen > maxOrders) {
        throw new SalesRangeTooLargeError(seen - 1, maxOrders)
      }
      yield order
    }

    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
}

/**
 * How many orders the store has in the period.
 */
export async function countVendorOrders(storeId: string, from: Date, to: Date): Promise<number> {
  return getPrisma().order.count({ where: vendorOrderWhere(storeId, from, to) })
}

/**
 * Refuse a report that covers more orders than the process can serve.
 */
export async function assertVendorRangeWithinLimit(
  storeId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const count = await countVendorOrders(storeId, from, to)
  if (count > MAX_ORDERS_PER_REPORT) {
    throw new SalesRangeTooLargeError(count)
  }
  return count
}

/**
 * The refunds of the store's orders in the period.
 */
export async function loadVendorRefunds(
  storeId: string,
  from: Date,
  to: Date,
): Promise<SalesSummaryRefundInput[]> {
  const prisma = getPrisma()

  const refunds = await prisma.refund.findMany({
    where: {
      order: vendorOrderWhere(storeId, from, to),
    },
    select: {
      id: true,
      orderId: true,
      amount: true,
      status: true,
      createdAt: true,
    },
  })

  return (refunds as any[]).map((refund) => ({
    id: refund.id,
    orderId: refund.orderId ?? null,
    amount: decimalToNumber(refund.amount),
    status: refund.status,
    createdAt: refund.createdAt,
  }))
}

/**
 * How many of the vendor's products still have a cost slot without a cost.
 *
 * Counted in the database so a shop with a large catalogue never has to be
 * loaded into memory to answer the question.
 */
export async function countMissingCostProducts(storeId: string): Promise<number> {
  return getPrisma().product.count({
    where: {
      storeId,
      costPrice: null,
      OR: [
        // A product with no variants has one cost slot of its own.
        { variants: { none: {} } },
        // A variant without its own cost inherits the product's cost, so it is
        // only missing when the product has none either.
        { variants: { some: { costPrice: null } } },
      ],
    },
  })
}

/**
 * Load every row the sales summary and the CSV export need for one store.
 *
 * `from` and `to` are the inclusive Accra calendar days of the report.
 *
 * This is the single-query path. It loads the whole period at once, so it is
 * only used where the period is known to be small (and by the tests that
 * check the streaming path agrees with it).
 */
export async function loadVendorSalesData(
  storeId: string,
  from: Date,
  to: Date,
): Promise<VendorSalesData> {
  const prisma = getPrisma()

  const products = await prisma.product.findMany({
    where: { storeId },
    select: {
      id: true,
      name: true,
      price: true,
      costPrice: true,
      variants: {
        select: {
          id: true,
          color: true,
          size: true,
          age: true,
          sku: true,
          price: true,
          costPrice: true,
        },
      },
    },
  })

  const productInfos: VendorProductCostInfo[] = products.map((product: any) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    costPrice: product.costPrice ?? null,
    variants: (product.variants || []).map((variant: any) => ({
      id: variant.id,
      label: variantLabel(variant),
      price: variant.price ?? null,
      costPrice: variant.costPrice ?? null,
    })),
  }))

  const missingCost = findMissingCostEntries(productInfos)
  const missingCostProducts = new Set(missingCost.map((entry) => entry.productId)).size
  const missingCostVariants = missingCost.filter((entry) => entry.productVariantId !== null).length

  if (productInfos.length === 0) {
    return {
      orders: [],
      refunds: [],
      products: productInfos,
      missingCost,
      missingCostProducts,
      missingCostVariants,
    }
  }

  const [orders, refunds] = await Promise.all([
    prisma.order.findMany({
      where: vendorOrderWhere(storeId, from, to),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: vendorSalesOrderSelect(storeId),
    }),
    prisma.refund.findMany({
      where: {
        order: vendorOrderWhere(storeId, from, to),
      },
      select: {
        id: true,
        orderId: true,
        amount: true,
        status: true,
        createdAt: true,
      },
    }),
  ])

  const orderInputs: SalesSummaryOrderInput[] = (orders as any[]).map(toVendorOrderInput)

  const refundInputs: SalesSummaryRefundInput[] = (refunds as any[]).map((refund) => ({
    id: refund.id,
    orderId: refund.orderId ?? null,
    amount: decimalToNumber(refund.amount),
    status: refund.status,
    createdAt: refund.createdAt,
  }))

  return {
    orders: orderInputs,
    refunds: refundInputs,
    products: productInfos,
    missingCost,
    missingCostProducts,
    missingCostVariants,
  }
}
