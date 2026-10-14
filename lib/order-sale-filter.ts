// One definition of "a sale" for every money and units reader.
//
// A sale is an order that was actually charged and was not subsequently
// cancelled: paymentStatus is PAID, and status is not CANCELLED. A fully
// refunded order settles to paymentStatus REFUNDED, so it is not a sale
// either - the money went back to the customer.
//
// Why this exists: a cancellation used to leave an order at
// CANCELLED + PAID until the refund pipeline settled it, and readers that
// filtered only on paymentStatus 'PAID' counted those orders as revenue,
// earnings, GMV and units sold. Sharing ONE filter here means every reader
// either excludes them or changes its mind deliberately.
//
// This module is pure: it builds query shapes and a predicate, and touches no
// database.

import { OrderStatus, PaymentStatus } from '@prisma/client'

/**
 * Every non-cancelled order status.
 *
 * Kept as a plain `OrderStatus[]`, not a `readonly` tuple, because these arrays are
 * spread straight into Prisma `where` inputs, and Prisma's generated types
 * demand a mutable `OrderStatus[]`. A `readonly` tuple is rejected.
 */
export const NOT_CANCELLED_STATUSES: OrderStatus[] = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
]

/**
 * Prisma `where` fragment for "this order counts as a sale".
 *
 * Spread it into an Order-level filter, or into an `order:` relation filter
 * on OrderItem. `REFUNDED` is excluded because `paymentStatus: { in: ['PAID'] }`
 * already excludes it, and `PAID` is listed explicitly rather than relying on
 * "not REFUNDED" so a future payment status cannot silently start counting.
 *
 * Properly typed as the Prisma enum arrays.
 */
export const SALE_ORDER_FILTER: {
  paymentStatus: { in: PaymentStatus[] }
  status: { notIn: OrderStatus[] }
} = {
  paymentStatus: { in: ['PAID'] as PaymentStatus[] },
  status: { notIn: ['CANCELLED'] as OrderStatus[] },
}

/**
 * Prisma `where` fragment for "this order counts as a sale", for a query that
 * already carries other conditions and must keep them.
 */
export function withSaleFilter<T extends Record<string, unknown>>(extra: T): T {
  return { ...extra, ...SALE_ORDER_FILTER }
}

/**
 * In-memory predicate for "this order counts as a sale".
 *
 * Accepts a plain object so callers can pass either a Prisma row or a shape
 * built in a test. A missing, null or unknown status is treated as NOT a
 * sale: the safe direction for a money reader is to exclude, and a status
 * this file does not know about has not been reviewed.
 */
export function isSaleOrder(order: {
  paymentStatus?: string | null
  status?: string | null
}): boolean {
  if (order.paymentStatus !== 'PAID') return false
  if (!order.status) return false
  return (NOT_CANCELLED_STATUSES as readonly string[]).includes(order.status)
}

/**
 * True when the order's money has gone back to the customer, so any label a
 * UI shows should read 'Refunded' rather than 'Cancelled'.
 */
export function isRefundedOrder(order: {
  paymentStatus?: string | null
  status?: string | null
}): boolean {
  return order.paymentStatus === 'REFUNDED' || order.status === 'REFUNDED'
}

/**
 * Customer-facing wording for a cancelled order, used by the customer order
 * pages, the order lists and the vendor views so the phrasing stays in one
 * place.
 *
 * 'Cancelled, refund pending review' while the refund request is still waiting
 * (CANCELLED and still PAID); 'Refunded' only once the order is REFUNDED; a
 * plain 'Cancelled' when nothing was ever charged.
 */
export function cancelledOrderLabel(order: {
  paymentStatus?: string | null
  status?: string | null
}): 'Cancelled, refund pending review' | 'Refunded' | 'Cancelled' {
  if (isRefundedOrder(order)) return 'Refunded'
  if (order.status === 'CANCELLED' && order.paymentStatus === 'PAID') {
    return 'Cancelled, refund pending review'
  }
  return 'Cancelled'
}
