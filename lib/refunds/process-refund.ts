// Central refund processing for Dhreamarket (Part A)
//
// Idempotency model (design gate amendment 1):
// - MANUAL refunds require a client-supplied requestId (UUID). That requestId
//   is the Refund.idempotencyKey verbatim.
// - Automatic flows use deterministic keys so a repeated event can never create
//   a second Paystack refund:
//     RETURN:<returnRequestId>
//     VENDOR_REJECTION:<orderItemId>
//     CUSTOMER_CANCEL:<orderItemId>
// - The key is NEVER derived from a count of existing refunds.
//
// Wallet model (design gate amendment 2):
// - No wallet credit code exists in this part.
// - processRefund refuses any order with walletAmountApplied > 0 (HTTP 409).
// - processRefund refuses wallet-only payments that have no paystackRef.
import type { Prisma, RefundStatus, OrderItem } from '@prisma/client'

export type RefundSource = 'MANUAL' | 'RETURN' | 'VENDOR_REJECTION' | 'CUSTOMER_CANCEL'
export type RefundTriggeredByRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'SYSTEM'

export type RefundActor = {
  triggeredByUserId?: string | null
  triggeredByRole?: RefundTriggeredByRole
}

export class RefundError extends Error {
  status: number
  code: string
  constructor(status: number, message: string, code = 'REFUND_ERROR') {
    super(message)
    this.name = 'RefundError'
    this.status = status
    this.code = code
  }
}

export function buildIdempotencyKey(source: RefundSource, ref: string): string {
  switch (source) {
    case 'MANUAL':
      // caller always supplies the UUID
      return ref
    case 'RETURN':
      return `RETURN:${ref}`
    case 'VENDOR_REJECTION':
      return `VENDOR_REJECTION:${ref}`
    case 'CUSTOMER_CANCEL':
      return `CUSTOMER_CANCEL:${ref}`
    default: {
      const exhaustive: never = source
      throw new Error(`Unknown refund source: ${exhaustive as string}`)
    }
  }
}

const MONOTONIC: Record<RefundStatus, RefundStatus[]> = {
  // From a state, the only states we are allowed to advance to.
  PENDING: ['PROCESSING', 'PROCESSED', 'FAILED', 'NEEDS_ATTENTION'],
  PROCESSING: ['PROCESSED', 'FAILED', 'NEEDS_ATTENTION'],
  PROCESSED: [],
  FAILED: [],
  NEEDS_ATTENTION: ['PROCESSING', 'PROCESSED', 'FAILED'],
}

export function canTransition(from: RefundStatus, to: RefundStatus): boolean {
  return from === to || MONOTONIC[from].includes(to)
}

/**
 * The refund statuses Paystack documents for a refund object.
 *
 * Source: https://paystack.com/docs/payments/refunds ("Refund status")
 *   pending          Refund initiated, waiting for response from the processor.
 *   processing       Refund has been received by the processor.
 *   needs-attention  You need to provide the customer's bank details to proceed.
 *   failed           The refund failed to process, and your account now reflects
 *                    the credited amount.
 *   processed        Refund has successfully been processed by the processor.
 *
 * 'success' is deliberately NOT listed: in Paystack's own table it is the
 * *transaction* status of a refund that FAILED ("failed ... Transaction
 * Status: Success"). Treating 'success' as PROCESSED would mark money as
 * returned when it was not, so an unrecognised status is never guessed.
 */
export const PAYSTACK_REFUND_STATUSES = [
  'pending',
  'processing',
  'needs-attention',
  'needs_attention',
  'failed',
  'processed',
] as const

/**
 * Map a Paystack refund status onto our RefundStatus.
 *
 * Returns null for a status we do not recognise. Callers MUST treat null as
 * "change nothing and notify the admins with the raw status string" - they
 * must never fall back to a guessed status.
 */
export function mapPaystackRefundStatus(paystackStatus: string | undefined): RefundStatus | null {
  switch (String(paystackStatus ?? '').trim().toLowerCase()) {
    case 'pending':
    case 'processing':
      return 'PROCESSING'
    case 'processed':
      return 'PROCESSED'
    case 'failed':
      return 'FAILED'
    case 'needs-attention':
    case 'needs_attention':
      return 'NEEDS_ATTENTION'
    default:
      return null
  }
}

/**
 * Price an order item. OrderItem.price is the unit price captured at purchase
 * time, so the item gross is simply price * quantity.
 */
function itemGross(item: Pick<OrderItem, 'price' | 'quantity'>): number {
  return Number(item.price) * item.quantity
}

/**
 * Pro-rated share of the payment amount that belongs to a single order item.
 *
 * The share is computed off what was actually charged (payment.amount), not the
 * order total, because a wallet may have reduced the charge. We always call
 * this after the wallet guard, so walletAmountApplied is 0 in practice, but
 * using the charged amount keeps the math correct if that ever changes.
 */
export function computeItemCap(
  itemGrossAmount: number,
  orderGrossTotal: number,
  paymentAmount: number
): number {
  if (orderGrossTotal <= 0 || itemGrossAmount <= 0) return 0
  return round2((itemGrossAmount / orderGrossTotal) * paymentAmount)
}

export function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export type ItemRefundInput = {
  orderItemId: string
  amount: number
}

export type CreateRefundInput = {
  orderId: string
  paymentId: string
  items: ItemRefundInput[]
  source: RefundSource
  /** For MANUAL, the client UUID. For automatic flows, the entity id part. */
  reference: string
  reason?: string
  currency?: string
  actor?: RefundActor
}

/**
 * Caps an existing payer (wallet-only, or wallet-assisted) order.
 * Returns null when the order is refundable.
 */
export function guardWalletOrder(order: { walletAmountApplied: unknown }): RefundError | null {
  const wallet = Number(order.walletAmountApplied ?? 0)
  if (wallet > 0) {
    return new RefundError(
      409,
      'paid partly or fully with wallet; refund manually',
      'WALLET_PAYMENT'
    )
  }
  return null
}

export type CapsResult = {
  paymentCap: number
  alreadyRefunded: number
  remaining: number
  itemCaps: Record<string, { gross: number; itemCap: number; alreadyRefunded: number; remaining: number }>
}

export class Caps {
  private constructor(private readonly data: CapsResult) {}

  get refundedTotal(): number {
    return this.data.alreadyRefunded
  }

  get paymentRemaining(): number {
    return this.data.remaining
  }

  itemRemaining(orderItemId: string): number {
    return this.data.itemCaps[orderItemId]?.remaining ?? 0
  }

  itemCap(orderItemId: string): number {
    return this.data.itemCaps[orderItemId]?.itemCap ?? 0
  }

  dump(): CapsResult {
    return this.data
  }

  /**
   * Validates a batch of requested item refunds against both the payment-level
   * cap and the per-item pro-rated cap. Throws RefundError with HTTP 400.
   */
  validate(items: ItemRefundInput[]): void {
    const perItemTotals = new Map<string, number>()
    for (const item of items) {
      if (!Number.isFinite(item.amount) || item.amount <= 0) {
        throw new RefundError(400, 'Refund amount must be greater than zero', 'INVALID_AMOUNT')
      }
      perItemTotals.set(item.orderItemId, (perItemTotals.get(item.orderItemId) ?? 0) + item.amount)
    }

    // forEach avoids iterator down-leveling: the tsconfig target is ES5.
    perItemTotals.forEach((amount, orderItemId) => {
      const cap = this.itemCap(orderItemId)
      const remaining = this.itemRemaining(orderItemId)
      if (cap <= 0) {
        throw new RefundError(400, `Order item ${orderItemId} is not refundable`, 'ITEM_NOT_REFUNDABLE')
      }
      if (round2(amount) > round2(remaining)) {
        throw new RefundError(
          400,
          `Refund amount ${round2(amount)} exceeds the refundable cap ${round2(remaining)} for order item ${orderItemId}`,
          'ITEM_CAP_EXCEEDED'
        )
      }
    })

    const total = round2(items.reduce((sum, item) => sum + item.amount, 0))
    if (total > round2(this.paymentRemaining)) {
      throw new RefundError(
        400,
        `Refund total ${total} exceeds remaining refundable payment amount ${round2(this.paymentRemaining)}`,
        'PAYMENT_CAP_EXCEEDED'
      )
    }
  }

  /**
   * Validates a single item refund and returns the effective amount that is
   * still refundable for it, after subtracting what is already refunded.
   */
  static forOrder(order: {
    id: string
    total: number
    items: Pick<OrderItem, 'id' | 'price' | 'quantity'>[]
    payment?: { id: string; amount: number } | null
    refunds?: { amount: Prisma.Decimal | number | null; status: RefundStatus; orderItemId: string | null }[]
  }): Caps {
    const paymentAmount = Number(order.payment?.amount ?? 0)
    const orderGrossTotal = order.items.reduce((sum, item) => sum + itemGross(item), 0)

    // A refund has already claimed its money as soon as it has been submitted
    // to Paystack, so only FAILED rows leave the cap untouched. Counting
    // PENDING rows prevents over-refunding while one is still in flight.
    const refunds = (order.refunds ?? []).filter((refund) => refund.status !== 'FAILED')

    const alreadyByItem = new Map<string, number>()
    for (const refund of refunds) {
      if (!refund.orderItemId) continue
      alreadyByItem.set(
        refund.orderItemId,
        round2((alreadyByItem.get(refund.orderItemId) ?? 0) + Number(refund.amount ?? 0))
      )
    }

    const itemCaps: CapsResult['itemCaps'] = {}
    for (const item of order.items) {
      const gross = itemGross(item)
      const itemCap = computeItemCap(gross, orderGrossTotal, paymentAmount)
      const alreadyRefunded = alreadyByItem.get(item.id) ?? 0
      itemCaps[item.id] = {
        gross: round2(gross),
        itemCap,
        alreadyRefunded,
        remaining: round2(Math.max(0, itemCap - alreadyRefunded)),
      }
    }

    const alreadyRefunded = round2(refunds.reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0))

    return new Caps({
      paymentCap: round2(paymentAmount),
      alreadyRefunded,
      remaining: round2(Math.max(0, paymentAmount - alreadyRefunded)),
      itemCaps,
    })
  }
}
