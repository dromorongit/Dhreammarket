import { OrderStatus, PaymentStatus } from '@prisma/client'
import { SALE_ORDER_FILTER } from './order-sale-filter'

/**
 * Sale filter restricted to platform (ONLINE) orders only.
 * Manual orders (source = MANUAL) must never enter platform money flows:
 * commission, payouts, vendor earnings, platform revenue, cashback, loyalty,
 * or trust metrics. Use this filter at every EXCLUDE site.
 */
export const ONLINE_SALE_ORDER_FILTER = {
  ...SALE_ORDER_FILTER,
  source: 'ONLINE',
} as const

/**
 * True when the order is a vendor-recorded manual (off-platform) order.
 * Manual orders never enter platform money or trust flows.
 */
export function isManualOrder(order: { source?: string | null }): boolean {
  return order.source === 'MANUAL'
}
