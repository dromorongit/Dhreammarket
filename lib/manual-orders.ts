import { randomBytes } from 'crypto'
import { SITE_URL } from '@/lib/site-config'
import { getUnitPrice } from '@/lib/pricing'
import { normalizeGhanaPhone } from '@/lib/phone'

export const MANUAL_ORDER_CURRENCY = 'GHS'
export const PESEWAS_PER_CEDI = 100
export const MANUAL_ORDER_MAX_QUANTITY = 1000
export const RECEIPT_TOKEN_BYTES = 16 // 32 hex chars

export type ManualChannel = 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'CALL' | 'WALK_IN' | 'OTHER'

export const MANUAL_CHANNELS: ManualChannel[] = [
  'WHATSAPP',
  'INSTAGRAM',
  'FACEBOOK',
  'CALL',
  'WALK_IN',
  'OTHER',
]

export interface ManualOrderLineInput {
  productId: string
  variantId?: string | null
  quantity: number
  unitPrice?: number | null
}

export interface ResolvedManualOrderLine {
  productId: string
  variantId: string | null
  quantity: number
  unitPricePesewas: number
  overridden: boolean
  /**
   * The unit cost captured at sale time, in pesewas, or null when the
   * product/variant has no cost price yet. Written to
   * `OrderItem.costPriceSnapshot` so that editing a cost later never
   * rewrites the profit of a past sale.
   */
  costPriceSnapshot?: number | null
}

export interface ManualOrderTotals {
  subtotalPesewas: number
  shippingPesewas: number
  totalPesewas: number
  subtotal: number
  shipping: number
  total: number
}

/**
 * Convert a cedi amount to integer pesewas (server-side money math).
 */
export function toPesewas(amount: number): number {
  return Math.round(amount * PESEWAS_PER_CEDI)
}

/**
 * Convert integer pesewas to a cedi Float for the DB boundary.
 */
export function fromPesewas(pesewas: number): number {
  return Number((pesewas / PESEWAS_PER_CEDI).toFixed(2))
}

/**
 * Validate a client-supplied cedi price: finite, > 0, at most 2 decimals.
 */
export function validateUnitPrice(unitPrice: unknown): { pesewas: number } | { error: string } {
  if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice)) {
    return { error: 'unitPrice must be a finite number' }
  }
  if (unitPrice <= 0) {
    return { error: 'unitPrice must be greater than 0' }
  }
  if (Math.round(unitPrice * PESEWAS_PER_CEDI) / PESEWAS_PER_CEDI !== unitPrice) {
    return { error: 'unitPrice must have at most 2 decimal places' }
  }
  return { pesewas: toPesewas(unitPrice) }
}

/**
 * Validate a delivery fee: finite, >= 0, at most 2 decimals.
 */
export function validateDeliveryFee(deliveryFee: unknown): { pesewas: number } | { error: string } {
  if (deliveryFee === undefined || deliveryFee === null) {
    return { pesewas: 0 }
  }
  if (typeof deliveryFee !== 'number' || !Number.isFinite(deliveryFee)) {
    return { error: 'deliveryFee must be a finite number' }
  }
  if (deliveryFee < 0) {
    return { error: 'deliveryFee must be >= 0' }
  }
  if (Math.round(deliveryFee * PESEWAS_PER_CEDI) / PESEWAS_PER_CEDI !== deliveryFee) {
    return { error: 'deliveryFee must have at most 2 decimal places' }
  }
  return { pesewas: toPesewas(deliveryFee) }
}

/**
 * Validate a manual order line quantity: integer 1..1000.
 */
export function validateQuantity(quantity: unknown): { quantity: number } | { error: string } {
  if (typeof quantity !== 'number' || !Number.isInteger(quantity)) {
    return { error: 'quantity must be an integer' }
  }
  if (quantity < 1 || quantity > MANUAL_ORDER_MAX_QUANTITY) {
    return { error: `quantity must be between 1 and ${MANUAL_ORDER_MAX_QUANTITY}` }
  }
  return { quantity }
}

export function validateChannel(channel: unknown): { channel: ManualChannel } | { error: string } {
  if (typeof channel !== 'string' || !MANUAL_CHANNELS.includes(channel as ManualChannel)) {
    return { error: `channel must be one of: ${MANUAL_CHANNELS.join(', ')}` }
  }
  return { channel: channel as ManualChannel }
}

export function validateIdempotencyKey(key: unknown): { idempotencyKey: string } | { error: string } {
  if (typeof key !== 'string' || key.trim().length === 0) {
    return { error: 'idempotencyKey is required' }
  }
  return { idempotencyKey: key.trim() }
}

/**
 * Resolve catalogue price via getUnitPrice, then apply optional vendor override.
 * All prices are snapshotted in integer pesewas.
 */
export function resolveLinePrice(
  product: { price: number; dealsPrice?: number | null; salesPrice?: number | null },
  variant: { price?: number | null } | null | undefined,
  unitPrice?: number | null,
): { unitPricePesewas: number; overridden: boolean; cataloguePricePesewas: number } | { error: string } {
  const cataloguePrice = getUnitPrice(product, variant ?? null)
  const cataloguePesewas = toPesewas(cataloguePrice)

  if (unitPrice === undefined || unitPrice === null) {
    return { unitPricePesewas: cataloguePesewas, overridden: false, cataloguePricePesewas: cataloguePesewas }
  }

  const validated = validateUnitPrice(unitPrice)
  if ('error' in validated) {
    return { error: validated.error }
  }
  return { unitPricePesewas: validated.pesewas, overridden: true, cataloguePricePesewas: cataloguePesewas }
}

export function computeOrderTotals(
  lines: Array<{ unitPricePesewas: number; quantity: number }>,
  shippingPesewas: number,
): ManualOrderTotals {
  const subtotalPesewas = lines.reduce((sum, line) => sum + line.unitPricePesewas * line.quantity, 0)
  const totalPesewas = subtotalPesewas + shippingPesewas
  return {
    subtotalPesewas,
    shippingPesewas,
    totalPesewas,
    subtotal: fromPesewas(subtotalPesewas),
    shipping: fromPesewas(shippingPesewas),
    total: fromPesewas(totalPesewas),
  }
}

/**
 * Generate a 32-char hex receipt token.
 */
export function generateReceiptToken(): string {
  return randomBytes(RECEIPT_TOKEN_BYTES).toString('hex')
}

/**
 * Build the public receipt URL from the public app URL env var (value never logged).
 */
export function buildReceiptUrl(receiptToken: string): string {
  return `${SITE_URL}/receipt/${receiptToken}`
}

/**
 * Build a wa.me share link: wa.me/<digits>?text=<encoded message with receipt URL>.
 */
export function buildWhatsAppShareLink(phone: string, receiptUrl: string): string {
  const normalized = normalizeGhanaPhone(phone)
  const digits = normalized ? normalized.replace(/\D/g, '') : phone.replace(/\D/g, '')
  const text = encodeURIComponent(`Your Dhreamarket receipt: ${receiptUrl}`)
  return `https://wa.me/${digits}?text=${text}`
}

export function normalizeCustomerPhone(phone: unknown): { phone: string } | { error: string } {
  if (typeof phone !== 'string' || phone.trim().length === 0) {
    return { error: 'customer.phone is required' }
  }
  const normalized = normalizeGhanaPhone(phone)
  if (!normalized) {
    return { error: 'customer.phone must be a valid Ghanaian number (e.g. 024XXXXXXXX, +233XXXXXXXXXX)' }
  }
  return { phone: normalized }
}

export function splitCustomerName(name: string): { firstName: string; lastName: string | null } {
  const trimmed = name.trim()
  const spaceIndex = trimmed.indexOf(' ')
  if (spaceIndex === -1) {
    return { firstName: trimmed, lastName: null }
  }
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() || null }
}

export function orderDisplayNumber(orderId: string): string {
  return orderId.slice(-8).toUpperCase()
}
