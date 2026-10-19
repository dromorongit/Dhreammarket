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

/**
 * Load every row the sales summary and the CSV export need for one store.
 *
 * `from` and `to` are the inclusive Accra calendar days of the report.
 */
export async function loadVendorSalesData(
  storeId: string,
  from: Date,
  to: Date,
): Promise<VendorSalesData> {
  const prisma = getPrisma()

  const rangeStart = accraDayStart(from)
  const rangeEnd = accraDayEndExclusive(to)

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

  const productIds = productInfos.map((product) => product.id)
  const missingCost = findMissingCostEntries(productInfos)
  const missingCostProducts = new Set(missingCost.map((entry) => entry.productId)).size
  const missingCostVariants = missingCost.filter((entry) => entry.productVariantId !== null).length

  if (productIds.length === 0) {
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
      where: {
        deletedAt: null,
        createdAt: { gte: rangeStart, lt: rangeEnd },
        items: { some: { productId: { in: productIds } } },
      },
      include: {
        items: {
          where: { productId: { in: productIds } },
          include: {
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
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.refund.findMany({
      where: {
        order: {
          deletedAt: null,
          createdAt: { gte: rangeStart, lt: rangeEnd },
          items: { some: { productId: { in: productIds } } },
        },
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

  const orderInputs: SalesSummaryOrderInput[] = (orders as any[]).map((order) => ({
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
  })) as SalesSummaryOrderInput[]

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
