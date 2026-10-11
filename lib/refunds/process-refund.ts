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
import { Prisma, type Prisma as PrismaTypes, type RefundStatus, type OrderItem } from '@prisma/client'

export type RefundSource = 'MANUAL' | 'RETURN' | 'VENDOR_REJECTION' | 'CUSTOMER_CANCEL'
export type RefundTriggeredByRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'SYSTEM'

/**
 * Narrow a session role to one the Refund audit trail accepts.
 *
 * The refund endpoints are SUPER_ADMIN only, so in practice this always
 * returns 'SUPER_ADMIN'. It exists so the recorded role is the role from the
 * verified session rather than a hardcoded string, while keeping roles that can
 * never trigger a refund (INFLUENCER, VENDOR, CUSTOMER) out of the enum.
 */
export function toRefundTriggeredByRole(role: string): RefundTriggeredByRole {
  return role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'SUPPORT' ||
    role === 'SYSTEM'
    ? role
    : 'ADMIN'
}

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
 * Price an order item in integer pesewas. OrderItem.price is the unit price
 * captured at purchase time, so the item gross is price * quantity. The
 * multiplication is exact decimal arithmetic, not floating point.
 */
function itemGrossPesewas(item: Pick<OrderItem, 'price' | 'quantity'>): number {
  return new Prisma.Decimal(item.price ?? 0).mul(item.quantity ?? 0).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber()
}

/** Item gross in GHS, kept for callers that display it. */
function itemGross(item: Pick<OrderItem, 'price' | 'quantity'>): number {
  return pesewasToGhs(itemGrossPesewas(item))
}

/**
 * Pro-rated share of the payment that belongs to a single order item.
 *
 * The share is computed off what was actually charged (payment.amount), not the
 * order total, because a wallet may have reduced the charge. We always call
 * this after the wallet guard, so walletAmountApplied is 0 in practice, but
 * using the charged amount keeps the math correct if that ever changes.
 *
 * Arithmetic is done in integer pesewas and converted back to GHS at the end,
 * so this is the exact pro-rata share of the whole payment. To get per-item
 * caps whose GHS total is exactly the payment amount, use the allocation in
 * Caps.forOrder, which assigns the rounding remainder to the last item.
 */
export function computeItemCap(
  itemGrossAmount: number | PrismaTypes.Decimal,
  orderGrossTotal: number | PrismaTypes.Decimal,
  paymentAmount: number | PrismaTypes.Decimal
): number {
  const paymentPesewas = toPesewas(paymentAmount)
  const itemGrossPesewas = toPesewas(itemGrossAmount)
  const totalGrossPesewas = toPesewas(orderGrossTotal)
  if (paymentPesewas <= 0 || itemGrossPesewas <= 0 || totalGrossPesewas <= 0) {
    return 0
  }
  return pesewasToGhs(
    Math.floor((paymentPesewas * itemGrossPesewas) / totalGrossPesewas)
  )
}

/** Convert integer pesewas back to a GHS amount. */
export function pesewasToGhs(pesewas: number): number {
  return new Prisma.Decimal(Math.round(pesewas)).dividedBy(100).toNumber()
}

export function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

/**
 * Convert a GHS amount (Prisma Decimal, number or numeric string) to integer
 * pesewas.
 *
 * The multiplication by 100 happens on a Prisma.Decimal in exact base-10
 * arithmetic, never on a binary float. A binary float carries 100.07 as
 * 100.07000000000002..., so Math.round(x * 100) can land on the wrong side of
 * a .5 boundary and off-by-one a refund. Decimal arithmetic has no such error.
 *
 * ROUND_HALF_UP matches how a human resolves an exact half, and toNumber() is
 * safe because the value is an exact integer that 2^53 always represents.
 */
export function toPesewas(amount: PrismaTypes.Decimal | number | string | null | undefined): number {
  if (amount === null || amount === undefined) return 0
  return new Prisma.Decimal(amount)
    .mul(100)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber()
}

/**
 * Allocate a payment amount, in integer pesewas, across order items in
 * proportion to each item's gross, with the rounding remainder added to the
 * LAST item.
 *
 * Because the allocation is pure integer arithmetic, the per-item shares are
 * exact integers and their sum is exactly paymentPesewas - there is never a
 * stray pesewa left over, which is what lets a full-order refund settle to
 * REFUNDED. Proportional shares can only lose or gain whole pesewas (the
 * integer division discards a remainder), so every discarded remainder is
 * collected and handed to the last item.
 *
 * `itemGross` must be given in the same order on every call for the same order
 * so the remainder always lands on the same item.
 */
export function allocatePesewas(
  itemGross: { orderItemId: string; grossPesewas: number }[],
  paymentPesewas: number
): Map<string, number> {
  const result = new Map<string, number>()
  const totalGross = itemGross.reduce((sum, entry) => sum + entry.grossPesewas, 0)

  if (itemGross.length === 0 || totalGross <= 0) {
    return result
  }

  const allocation: number[] = []
  let allocated = 0
  for (let i = 0; i < itemGross.length; i++) {
    // Largest-remainder style floor division in integers.
    const share =
      paymentPesewas >= 0
        ? Math.floor((paymentPesewas * itemGross[i].grossPesewas) / totalGross)
        : Math.ceil((paymentPesewas * itemGross[i].grossPesewas) / totalGross)
    allocation[i] = share
    allocated += share
  }

  // The remainder - every pesewa the floor division dropped - goes to the last
  // item, so the shares sum exactly to the payment.
  allocation[allocation.length - 1] += paymentPesewas - allocated

  for (let i = 0; i < itemGross.length; i++) {
    result.set(itemGross[i].orderItemId, allocation[i])
  }
  return result
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
   *
   * Comparisons are made in integer pesewas so a 1-pesewa difference can never
   * be decided by floating-point noise.
   */
  validate(items: ItemRefundInput[]): void {
    const perItemTotals = new Map<string, number>()
    for (const item of items) {
      if (!Number.isFinite(item.amount) || item.amount <= 0) {
        throw new RefundError(400, 'Refund amount must be greater than zero', 'INVALID_AMOUNT')
      }
      // A refund must be expressible in whole pesewas. Anything finer cannot be
      // allocated or settled exactly, so it is refused rather than rounded.
      if (round2(item.amount) !== item.amount) {
        throw new RefundError(
          400,
          `Refund amount ${item.amount} must have at most two decimal places`,
          'INVALID_AMOUNT'
        )
      }
      perItemTotals.set(
        item.orderItemId,
        (perItemTotals.get(item.orderItemId) ?? 0) + toPesewas(item.amount)
      )
    }

    // forEach avoids iterator down-leveling: the tsconfig target is ES5.
    perItemTotals.forEach((requestedPesewas, orderItemId) => {
      const capPesewas = toPesewas(this.itemCap(orderItemId))
      const remainingPesewas = toPesewas(this.itemRemaining(orderItemId))
      if (capPesewas <= 0) {
        throw new RefundError(400, `Order item ${orderItemId} is not refundable`, 'ITEM_NOT_REFUNDABLE')
      }
      if (requestedPesewas > remainingPesewas) {
        throw new RefundError(
          400,
          `Refund amount ${pesewasToGhs(requestedPesewas)} exceeds the refundable cap ${pesewasToGhs(remainingPesewas)} for order item ${orderItemId}`,
          'ITEM_CAP_EXCEEDED'
        )
      }
    })

    const totalPesewas = items.reduce((sum, item) => sum + toPesewas(item.amount), 0)
    const remainingPaymentPesewas = toPesewas(this.paymentRemaining)
    if (totalPesewas > remainingPaymentPesewas) {
      throw new RefundError(
        400,
        `Refund total ${pesewasToGhs(totalPesewas)} exceeds remaining refundable payment amount ${pesewasToGhs(remainingPaymentPesewas)}`,
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
    payment?: { id: string; amount: number | PrismaTypes.Decimal } | null
    refunds?: { amount: Prisma.Decimal | number | null; status: RefundStatus; orderItemId: string | null }[]
  }): Caps {
    const paymentAmount = Number(order.payment?.amount ?? 0)
    const itemGrossPesewas = order.items.map((item) => ({
      orderItemId: item.id,
      grossPesewas: toPesewas(itemGross(item)),
    }))

    // Per-item caps in integer pesewas, proportional to each item's gross, with
    // the rounding remainder on the last item. These sum exactly to the payment.
    const itemCapPesewas = allocatePesewas(itemGrossPesewas, toPesewas(paymentAmount))

    // A refund has already claimed its money as soon as it has been submitted
    // to Paystack, so only FAILED rows leave the cap untouched. Counting
    // PENDING rows prevents over-refunding while one is still in flight.
    const refunds = (order.refunds ?? []).filter((refund) => refund.status !== 'FAILED')

    const alreadyByItem = new Map<string, number>()
    for (const refund of refunds) {
      if (!refund.orderItemId) continue
      const previous = alreadyByItem.get(refund.orderItemId) ?? 0
      alreadyByItem.set(refund.orderItemId, previous + toPesewas(refund.amount))
    }

    const itemCaps: CapsResult['itemCaps'] = {}
    for (const item of order.items) {
      const grossPesewas = itemGrossPesewas.find((entry) => entry.orderItemId === item.id)!.grossPesewas
      const capPesewas = itemCapPesewas.get(item.id) ?? 0
      const alreadyRefundedPesewas = alreadyByItem.get(item.id) ?? 0
      itemCaps[item.id] = {
        gross: pesewasToGhs(grossPesewas),
        itemCap: pesewasToGhs(capPesewas),
        alreadyRefunded: pesewasToGhs(alreadyRefundedPesewas),
        remaining: pesewasToGhs(Math.max(0, capPesewas - alreadyRefundedPesewas)),
      }
    }

    const alreadyRefundedPesewas = refunds.reduce(
      (sum, refund) => sum + toPesewas(refund.amount),
      0
    )

    return new Caps({
      paymentCap: round2(paymentAmount),
      alreadyRefunded: pesewasToGhs(alreadyRefundedPesewas),
      remaining: pesewasToGhs(Math.max(0, toPesewas(paymentAmount) - alreadyRefundedPesewas)),
      itemCaps,
    })
  }
}
