// Refund service: creating Paystack refunds and reconciling stuck rows.
//
// See lib/refunds/process-refund.ts for the cap/idempotency/wallet rules.
//
// Item caps: a Refund row always belongs to exactly one OrderItem, so every
// call is a single-item refund and the key is exactly the deterministic /
// client-supplied value. Order-level helpers below fan out to one row per item,
// scoping the key with the item id only when more than one item is refunded.
import { getPrisma } from '@/lib/prisma'
import { createPaystackRefund, listPaystackRefunds, type PaystackRefund, type PaystackRefundError } from '@/lib/paystack'
import {
  Caps,
  RefundError,
  buildIdempotencyKey,
  canTransition,
  guardWalletOrder,
  mapPaystackRefundStatus,
  pesewasToGhs,
  toPesewas,
  type RefundActor,
  type RefundSource,
} from './process-refund'
import { notifyRefundProcessed } from './refund-email'
import { createAuditLog } from '@/lib/audit-log'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { releaseStock } from '@/lib/stock-reservation'
import { reverseInfluencerOrderCashback } from '@/lib/influencer/order-cashback'
import { createNotification } from '@/lib/notifications'
import { logError, logInfo, logWarn } from '@/lib/logger'
import type { Prisma, RefundStatus } from '@prisma/client'

/** A stuck PENDING refund with no Paystack id is eligible for manual resolution
  * only after this long, so a slow webhook always gets its chance first. */
export const STUCK_REFUND_MIN_AGE_MS = 10 * 60 * 1000

const CREATION_TIME_TOLERANCE_MS = 60_000

/**
 * Paystack HTTP statuses that prove the refund was definitively refused.
 *
 * A status in this set, together with a message Paystack actually returned,
 * is the ONLY thing allowed to mark a Refund row FAILED from the create or
 * resubmit path. Everything else is indeterminate: the refund may well have
 * succeeded at Paystack even though we could not see the answer.
 */
const DEFINITE_REJECTION_HTTP_STATUSES = [400, 401, 403, 404, 422]

/**
 * True only when Paystack definitively refused the refund: an HTTP status that
 * means "rejected", with a message that actually came from Paystack.
 *
 * A TIMEOUT, a NETWORK_ERROR, a 5xx, a 429, an unparseable body, a status
 * outside the set above, or our own generic fallback message are all NOT
 * definite, so the row must stay PENDING and be reconciled later.
 */
function isDefinitePaystackRejection(error?: PaystackRefundError): boolean {
  if (!error) return false
  if (error.code !== 'API_ERROR') return false
  if (error.messageSource !== 'PAYSTACK') return false
  return DEFINITE_REJECTION_HTTP_STATUSES.includes(error.httpStatus ?? 0)
}

/**
 * A short, non-sensitive code describing an indeterminate Paystack outcome.
 * Stored in Refund.failureReason so an admin can see why the row is stuck
 * without any free-form text or key material being persisted.
 */
function indeterminateNote(error?: PaystackRefundError): string {
  switch (error?.code) {
    case 'TIMEOUT':
      return 'PAYSTACK_TIMEOUT'
    case 'NETWORK_ERROR':
      return 'PAYSTACK_NETWORK_ERROR'
    case 'NOT_CONFIGURED':
      return 'PAYSTACK_NOT_CONFIGURED'
    case 'API_ERROR': {
      const status = error.httpStatus ?? 0
      if (status === 429) return 'PAYSTACK_RATE_LIMITED'
      if (status >= 500) return `PAYSTACK_HTTP_${status}`
      // A 4xx outside the definite set, or an unparseable response.
      return 'PAYSTACK_UNPARSEABLE_RESPONSE'
    }
    default:
      return 'PAYSTACK_UNKNOWN_ERROR'
  }
}

/** Admin-facing note for a Paystack status we do not recognise. */
const UNKNOWN_STATUS_NOTE = 'UNKNOWN_PAYSTACK_STATUS'

export const REFUNDABLE_ORDER_STATUS = 'PAID'

export type RefundItemInput = {
  orderItemId: string
  amount?: number
}

export type CreateRefundInput = {
  orderId: string
  /** Omit to refund every remaining refundable item at its full remaining cap. */
  items?: RefundItemInput[]
  source: RefundSource
  /**
   * MANUAL: the client-supplied requestId (UUID).
   * RETURN: the ReturnRequest id.
   * VENDOR_REJECTION / CUSTOMER_CANCEL: the OrderItem id.
   */
  reference: string
  returnRequestId?: string
  reason?: string
  currency?: string
  actor: RefundActor
}

export type RefundRowResult = {
  id: string
  idempotencyKey: string
  orderItemId: string
  amount: number
  status: RefundStatus
  paystackRefundId: string | null
  paystackStatus: string | null
  failureReason: string | null
  alreadyExisted: boolean
}

export type CreateRefundResult = {
  orderId: string
  refunds: RefundRowResult[]
  orderRefunded: boolean
  alreadyProcessed: boolean
}

function resolveIdempotencyKey(
  source: RefundSource,
  reference: string,
  orderItemId: string,
  singleItem: boolean
): string {
  const base = buildIdempotencyKey(source, reference)
  return singleItem ? base : `${base}::${orderItemId}`
}

function matchesAmount(storedAmount: unknown, paystackAmount: number): boolean {
  if (storedAmount === null || storedAmount === undefined) return paystackAmount === 0
  // A Decimal from Prisma, a plain number, or a numeric string.
  return toPesewas(storedAmount as Prisma.Decimal | number | string) === paystackAmount
}

function matchesCreationTime(stored: Date | null, paystackCreatedAt: string | null): boolean {
  if (!stored || !paystackCreatedAt) return false
  const a = new Date(stored).getTime()
  const b = new Date(paystackCreatedAt).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) <= CREATION_TIME_TOLERANCE_MS
}

function findPaystackCandidates(
  refundAmount: unknown,
  refundCreatedAt: Date | null,
  paystackRefunds: PaystackRefund[],
  paystackRefundId: string | null
): PaystackRefund[] {
  if (paystackRefundId) {
    const exact = paystackRefunds.filter((r) => String(r.id) === String(paystackRefundId))
    if (exact.length > 0) return exact
  }
  return paystackRefunds.filter(
    (r) => matchesAmount(refundAmount, r.amount) && matchesCreationTime(refundCreatedAt, r.createdAt)
  )
}

const orderInclude = {
  payment: true,
  items: true,
  refunds: true,
  user: { select: { id: true, email: true, profile: { select: { firstName: true } } } },
} as const

/**
 * Create Paystack refunds for an order. Idempotent: repeating the same
 * requestId (manual) or the same deterministic key (automatic flow) never
 * issues a second Paystack refund.
 */
export async function createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
  const prisma = getPrisma()

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: orderInclude,
  })

  if (!order || !order.payment) {
    throw new RefundError(404, 'Order or payment not found', 'NOT_FOUND')
  }

  const payment = order.payment
  if (order.paymentStatus !== REFUNDABLE_ORDER_STATUS) {
    throw new RefundError(409, 'Only paid orders can be refunded', 'NOT_REFUNDABLE')
  }

  const walletError = guardWalletOrder(order)
  if (walletError) throw walletError

  if (!payment.paystackRef) {
    throw new RefundError(
      409,
      'paid partly or fully with wallet; refund manually',
      'WALLET_ONLY_PAYMENT'
    )
  }

  const caps = Caps.forOrder(order)

  const orderItemIds = new Set(order.items.map((item) => item.id))
  let requested: RefundItemInput[]
  if (input.items && input.items.length > 0) {
    for (const item of input.items) {
      if (!orderItemIds.has(item.orderItemId)) {
        throw new RefundError(
          400,
          `Order item ${item.orderItemId} does not belong to this order`,
          'UNKNOWN_ORDER_ITEM'
        )
      }
    }
    requested = input.items
  } else {
    requested = order.items
      .filter((item) => caps.itemRemaining(item.id) > 0)
      .map((item) => ({ orderItemId: item.id }))
  }

  if (requested.length === 0) {
    throw new RefundError(400, 'This order has nothing left to refund', 'NOTHING_TO_REFUND')
  }

  const settled = requested.map((item) => ({
    orderItemId: item.orderItemId,
    // The remaining cap is already an exact 2-decimal GHS figure derived from
    // integer pesewas, so no rounding repair is needed here.
    amount: item.amount ?? caps.itemRemaining(item.orderItemId),
  }))

  const singleItem = settled.length === 1

  if (input.source === 'MANUAL' && singleItem) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidPattern.test(input.reference)) {
      throw new RefundError(400, 'A valid requestId (UUID) is required for manual refunds', 'INVALID_REQUEST_ID')
    }
  }

  const keys = settled.map((item) => ({
    item,
    idempotencyKey: resolveIdempotencyKey(
      input.source,
      input.reference,
      item.orderItemId,
      singleItem
    ),
  }))

  // Idempotency is checked BEFORE the caps, so repeating a requestId can never
  // be rejected as "over the remaining cap" simply because the first attempt
  // already consumed it. The key is never derived from a refund count.
  const existingRows = await prisma.refund.findMany({
    where: { idempotencyKey: { in: keys.map((entry) => entry.idempotencyKey) } },
  })
  const existingByKey = new Map(existingRows.map((row) => [row.idempotencyKey, row]))

  if (existingByKey.size === keys.length) {
    return {
      orderId: order.id,
      refunds: keys.map(({ item, idempotencyKey }) => {
        const row = existingByKey.get(idempotencyKey)!
        return {
          id: row.id,
          idempotencyKey: row.idempotencyKey,
          orderItemId: row.orderItemId,
          amount: pesewasToGhs(toPesewas(row.amount)),
          status: row.status,
          paystackRefundId: row.paystackRefundId,
          paystackStatus: row.paystackStatus,
          failureReason: row.failureReason,
          alreadyExisted: true,
        }
      }),
      orderRefunded: false,
      alreadyProcessed: true,
    }
  }

  // Only rows that do not exist yet consume the cap.
  caps.validate(keys.filter((entry) => !existingByKey.has(entry.idempotencyKey)).map((entry) => entry.item))

  const results: RefundRowResult[] = []
  const pending: RefundRowResult[] = []

  // Everything that touches Refund rows happens under the Payment row lock, so
  // concurrent callers (a webhook and an admin action, say) serialise.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${payment.id} FOR UPDATE`

      for (const { item, idempotencyKey } of keys) {
        const existing = existingByKey.get(idempotencyKey) ?? (await tx.refund.findUnique({ where: { idempotencyKey } }))

        if (existing) {
          results.push({
            id: existing.id,
            idempotencyKey: existing.idempotencyKey,
            orderItemId: existing.orderItemId,
            amount: pesewasToGhs(toPesewas(existing.amount)),
            status: existing.status,
            paystackRefundId: existing.paystackRefundId,
            paystackStatus: existing.paystackStatus,
            failureReason: existing.failureReason,
            alreadyExisted: true,
          })
          continue
        }

        const row = await tx.refund.create({
          data: {
            paymentId: payment.id,
            orderItemId: item.orderItemId,
            orderId: order.id,
            amount: item.amount,
            status: 'PENDING',
            idempotencyKey,
            currency: input.currency || 'GHS',
            reason: input.reason,
            returnRequestId: input.returnRequestId,
            initiatedByUserId: input.actor.triggeredByUserId ?? null,
            initiatedByRole: input.actor.triggeredByRole ?? null,
          },
        })

        const rowResult: RefundRowResult = {
          id: row.id,
          idempotencyKey: row.idempotencyKey,
          orderItemId: row.orderItemId,
          amount: item.amount,
          status: row.status,
          paystackRefundId: null,
          paystackStatus: null,
          failureReason: null,
          alreadyExisted: false,
        }
        results.push(rowResult)
        pending.push(rowResult)
      }
    })
  } catch (error) {
    if (error instanceof RefundError) throw error
    throw new RefundError(
      409,
      error instanceof Error ? `Concurrent refund conflict: ${error.message}` : 'Concurrent refund in progress.',
      'CONCURRENT_REFUND'
    )
  }

  // 2. Call Paystack once per brand new row.
  const needsAttention: {
    refundId: string
    note: string
    unknownPaystackStatus?: string
  }[] = []

  for (const row of pending) {
    if (row.alreadyExisted) continue

  // Paystack does not expose its numeric transaction id when a transaction is
  // initiated by reference, so the DHV- reference is our identifier on both
  // the create call and the list filter. This matches the refund webhook, whose
  // data.transaction_reference / data.transaction.reference is also this value.
  const paystackTransactionReference = payment.reference

  const paystackResult = await createPaystackRefund(paystackTransactionReference, toPesewas(row.amount), {
    currency: 'GHS',
    merchantNote: input.reason,
  })

    // A definite Paystack rejection is the only failure that settles the row.
    // It frees the caps because that money will never move.
    if (!paystackResult.success && isDefinitePaystackRejection(paystackResult.error)) {
      const message = paystackResult.error?.message ?? 'Paystack refund failed'
      await prisma.refund.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          failureReason: message,
        },
      })
      row.status = 'FAILED'
      row.failureReason = message
      continue
    }

    if (paystackResult.success && paystackResult.refund) {
      const paystackRefundId = String(paystackResult.refund.id)
      const paystackStatus = paystackResult.refund.status
      const nextStatus = mapPaystackRefundStatus(paystackStatus)

      if (nextStatus === null) {
        // Paystack answered with a status we do not recognise. Never guess:
        // leave the row PENDING with no Paystack id attached, store a short
        // code only, and tell the admins. Reconciliation resolves it later.
        await prisma.refund.update({
          where: { id: row.id },
          data: {
            paystackRefundId: null,
            paystackStatus: null,
            failureReason: UNKNOWN_STATUS_NOTE,
          },
        })
        row.paystackRefundId = null
        row.paystackStatus = null
        row.failureReason = UNKNOWN_STATUS_NOTE
        row.status = 'PENDING'
        needsAttention.push({
          refundId: row.id,
          note: UNKNOWN_STATUS_NOTE,
          unknownPaystackStatus: paystackStatus,
        })
        continue
      }

      await prisma.refund.update({
        where: { id: row.id },
        data: {
          paystackRefundId,
          paystackStatus,
          status: nextStatus,
          processedAt: nextStatus === 'PROCESSED' ? new Date() : null,
        },
      })
      row.status = nextStatus
      row.paystackRefundId = paystackRefundId
      row.paystackStatus = paystackStatus

      if (nextStatus === 'PROCESSED') {
        await notifyRefundProcessed(row.id)
      }
      continue
    }

    // Indeterminate: the refund may have gone through at Paystack, so the row
    // stays PENDING with no Paystack id, keeps counting against every cap, and
    // carries a short code rather than any message text.
    const note = indeterminateNote(paystackResult.error)
    await prisma.refund.update({
      where: { id: row.id },
      data: {
        paystackRefundId: null,
        paystackStatus: null,
        failureReason: note,
      },
    })
    row.paystackRefundId = null
    row.paystackStatus = null
    row.failureReason = note
    row.status = 'PENDING'
    needsAttention.push({ refundId: row.id, note })
  }

  if (needsAttention.length > 0) {
    await notifyAdminsRefundNeedsChecking(input.orderId, needsAttention)
  }

  const orderRefunded = await settleOrderIfFullyRefunded(order.id)

  return {
    orderId: order.id,
    refunds: results,
    orderRefunded,
    alreadyProcessed: results.length > 0 && pending.length === 0,
  }
}

/** Track rows created inside the transaction that still need a Paystack call. */
async function settleOrderIfFullyRefunded(orderId: string): Promise<boolean> {
  const prisma = getPrisma()

  const latest = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true, items: true, refunds: true },
  })
  if (!latest || !latest.payment) return false

  // Only a refund that actually reached PROCESSED has returned money, so it is
  // the only thing that counts towards covering the payment.
  const processedRefunds = latest.refunds.filter((refund) => refund.status === 'PROCESSED')
  const outstanding = latest.refunds.filter(
    (refund) => refund.status !== 'PROCESSED' && refund.status !== 'FAILED'
  )

  const refundedPesewas = processedRefunds.reduce((sum, refund) => sum + toPesewas(refund.amount), 0)
  const paymentPesewas = toPesewas(latest.payment.amount)

  if (outstanding.length > 0 || refundedPesewas < paymentPesewas) {
    return false
  }
  // At this point the integer pesewa totals are equal, so the order settles.
  const refundedTotal = pesewasToGhs(refundedPesewas)
  const paymentTotal = pesewasToGhs(paymentPesewas)

  await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: 'REFUNDED' },
  })
  await prisma.payment.update({
    where: { id: latest.payment.id },
    data: { status: 'REFUNDED' },
  })

  logInfo('Order fully refunded', { orderId, refundedTotal, paymentTotal })

  // Reverse influencer cashback (idempotent) and put stock back.
  try {
    await reverseInfluencerOrderCashback(orderId)
  } catch (error) {
    logError('Failed to reverse influencer cashback on refund', error)
  }

  try {
    const release = await releaseStock(orderId)
    if (!release.success) {
      logError('Failed to release stock after refund', new Error(release.error ?? 'unknown'))
    }
  } catch (error) {
    logError('Failed to release stock after refund', error)
  }

  try {
    await recordFulfillmentEvent(orderId, 'REFUNDED', latest.userId, {
      description: 'Order refunded in full via the super admin refund flow.',
    })
  } catch (error) {
    logError('Failed to record refund fulfillment event', error)
  }

  try {
    await createAuditLog({
      userId: orderId,
      userRole: 'SYSTEM',
      action: 'ORDER_REFUNDED',
      entityType: 'ORDER',
      entityId: orderId,
      afterData: { refundedTotal, paymentTotal },
    })
  } catch (error) {
    logError('Failed to create refund audit log', error)
  }

  return true
}

export type CheckStatusAction = 'MARK_FAILED' | 'RESUBMIT'

export type CheckStatusResult = {
  refundId: string
  status: RefundStatus
  paystackRefundId: string | null
  paystackStatus: string | null
  outcome:
    | 'ALREADY_FINAL'
    | 'RECONCILED'
    | 'ATTACHED'
    | 'UNCHANGED'
    | 'AMBIGUOUS'
    | 'NO_MATCH'
    | 'UNKNOWN_STATUS'
    | 'INDETERMINATE'
    | 'MARKED_FAILED'
    | 'RESUBMITTED'
  message: string
  eligibleForManualResolution: boolean
  eligibleAt: Date | null
}

/**
 * Admin "check status" for a refund row.
 *
 * - Rows that already know their Paystack id are re-checked against Paystack.
 * - PENDING rows WITHOUT a Paystack id get their unique match attached from
 *   Paystack's list.
 * - Otherwise, once the row is at least 10 minutes old, a member of staff can
 *   mark it FAILED or resubmit it under the same row and Payment lock. Both
 *   actions are idempotent and hold the Payment row lock.
 */
export async function checkRefundStatus(
  refundId: string,
  actor: RefundActor,
  action?: CheckStatusAction
): Promise<CheckStatusResult> {
  const prisma = getPrisma()

  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: {
      payment: { include: { order: true } },
      orderItem: { select: { productId: true, quantity: true, price: true } },
    },
  })

  if (!refund || !refund.payment) {
    throw new RefundError(404, 'Refund not found', 'REFUND_NOT_FOUND')
  }

  if (!refund.payment.paystackRef) {
    throw new RefundError(409, 'This refund has no Paystack transaction reference', 'NOT_A_PAYSTACK_REFUND')
  }

  const eligibleAt = new Date(refund.createdAt.getTime() + STUCK_REFUND_MIN_AGE_MS)
  const eligibleForManualResolution = Date.now() >= eligibleAt.getTime()

  // Captured before the early return below narrows the type, so the transition
  // into PROCESSED stays explicit.
  const previousStatus: RefundStatus = refund.status

  if (refund.status === 'PROCESSED' || refund.status === 'FAILED') {
    return {
      refundId,
      status: refund.status,
      paystackRefundId: refund.paystackRefundId,
      paystackStatus: refund.paystackStatus,
      outcome: 'ALREADY_FINAL',
      message: 'This refund has already reached a final status.',
      eligibleForManualResolution,
      eligibleAt,
    }
  }

  const listResult = await listPaystackRefunds(refund.payment.reference)
  if (!listResult.success) {
    throw new RefundError(
      502,
      listResult.error?.message ?? 'Unable to read Paystack refund status',
      'PAYSTACK_UNREACHABLE'
    )
  }

  const candidates = findPaystackCandidates(
    refund.amount,
    refund.createdAt,
    listResult.refunds,
    refund.paystackRefundId
  )

  // A unique match: attach or reconcile it. No admin action needed.
  if (candidates.length === 1) {
    const match = candidates[0]
    const nextStatus = mapPaystackRefundStatus(match.status)

    if (nextStatus === null) {
      // An unrecognised Paystack status is never guessed at. The row keeps its
      // status and is left with no Paystack id attached so reconciliation can
      // match it again; the admins are told the raw status string.
      await notifyAdminsRefundNeedsChecking(refund.payment.orderId, [
        {
          refundId,
          note: UNKNOWN_STATUS_NOTE,
          unknownPaystackStatus: match.status,
        },
      ])
      return {
        refundId,
        status: refund.status,
        paystackRefundId: null,
        paystackStatus: null,
        outcome: 'UNKNOWN_STATUS',
        message: `Paystack reported an unrecognised refund status "${match.status}". Nothing was changed - an administrator has been notified.`,
        eligibleForManualResolution,
        eligibleAt,
      }
    }

    if (canTransition(refund.status, nextStatus)) {
      await prisma.refund.update({
        where: { id: refundId },
        data: {
          paystackRefundId: String(match.id),
          paystackStatus: match.status,
          status: nextStatus,
          // The refund is confirmed now, so any earlier inconclusive note
          // (PAYSTACK_TIMEOUT and friends) no longer applies.
          failureReason: null,
          processedAt:
            (nextStatus === 'PROCESSED' || nextStatus === 'FAILED') && !refund.processedAt
              ? new Date()
              : refund.processedAt,
        },
      })
    }

    const attached = !refund.paystackRefundId
    const becameProcessed = nextStatus === 'PROCESSED' && previousStatus !== 'PROCESSED'

    if (nextStatus === 'PROCESSED' || nextStatus === 'FAILED') {
      await settleOrderIfFullyRefunded(refund.payment.orderId)
    }

    if (becameProcessed) {
      await notifyRefundProcessed(refundId)
    }

    return {
      refundId,
      status: nextStatus,
      paystackRefundId: String(match.id),
      paystackStatus: match.status,
      outcome: attached ? 'ATTACHED' : 'RECONCILED',
      message: attached
        ? 'Matched the Paystack refund and attached it to this record.'
        : 'Refund status refreshed from Paystack.',
      eligibleForManualResolution,
      eligibleAt,
    }
  }

  if (candidates.length > 1) {
    await notifyAdminsOfAmbiguity(refund.payment.reference, refundId)
    return {
      refundId,
      status: refund.status,
      paystackRefundId: refund.paystackRefundId,
      paystackStatus: refund.paystackStatus,
      outcome: 'AMBIGUOUS',
      message:
        'More than one Paystack refund matches this record. Nothing was changed - an administrator has been notified.',
      eligibleForManualResolution,
      eligibleAt,
    }
  }

  // No match at all. Manual resolution needs both the 10 minute grace period
  // and an explicit action.
  if (!action) {
    return {
      refundId,
      status: refund.status,
      paystackRefundId: refund.paystackRefundId,
      paystackStatus: refund.paystackStatus,
      outcome: 'NO_MATCH',
      message: eligibleForManualResolution
        ? 'No matching Paystack refund found. You can mark this refund failed or resubmit it.'
        : 'No matching Paystack refund found yet. It becomes eligible for manual resolution at the time below.',
      eligibleForManualResolution,
      eligibleAt,
    }
  }

  if (!eligibleForManualResolution) {
    throw new RefundError(
      409,
      `This refund is not old enough for manual resolution. It becomes eligible at ${eligibleAt.toISOString()}.`,
      'TOO_EARLY_FOR_MANUAL_RESOLUTION'
    )
  }

  if (action === 'MARK_FAILED') {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${refund.paymentId} FOR UPDATE`

      // Idempotent: a webhook may have settled it while we waited for the lock.
      const fresh = await tx.refund.findUnique({ where: { id: refundId } })
      if (!fresh) throw new RefundError(404, 'Refund not found', 'REFUND_NOT_FOUND')
      if (fresh.status === 'PROCESSED' || fresh.status === 'FAILED') {
        return {
          refundId,
          status: fresh.status,
          paystackRefundId: fresh.paystackRefundId,
          paystackStatus: fresh.paystackStatus,
          outcome: 'ALREADY_FINAL' as const,
          message: 'This refund was already settled.',
          eligibleForManualResolution,
          eligibleAt,
        }
      }

      await tx.refund.update({
        where: { id: refundId },
        data: {
          status: 'FAILED',
          failureReason: 'Marked failed by an administrator: no matching Paystack refund exists.',
        },
      })

      await settleOrderIfFullyRefunded(refund.payment.orderId)

      return {
        refundId,
        status: 'FAILED' as RefundStatus,
        paystackRefundId: fresh.paystackRefundId,
        paystackStatus: fresh.paystackStatus,
        outcome: 'MARKED_FAILED' as const,
        message: 'Refund marked as failed.',
        eligibleForManualResolution,
        eligibleAt,
      }
    })
  }

    // RESUBMIT: re-issue the Paystack refund under the same row.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM payments WHERE id = ${refund.paymentId} FOR UPDATE`

    const fresh = await tx.refund.findUnique({ where: { id: refundId } })
    if (!fresh) throw new RefundError(404, 'Refund not found', 'REFUND_NOT_FOUND')
    // Captured before the guard below narrows the type.
    const previousFreshStatus: RefundStatus = fresh.status
    if (fresh.status === 'PROCESSED' || fresh.status === 'FAILED' || fresh.paystackRefundId) {
      return {
        refundId,
        status: fresh.status,
        paystackRefundId: fresh.paystackRefundId,
        paystackStatus: fresh.paystackStatus,
        outcome: 'ALREADY_FINAL' as const,
        message: 'This refund is already linked to a Paystack refund. Refresh its status instead.',
        eligibleForManualResolution,
        eligibleAt,
      }
    }

    const paystackResult = await createPaystackRefund(
      refund.payment.reference,
      toPesewas(fresh.amount),
      { merchantNote: fresh.reason ?? undefined }
    )

    // A definite Paystack rejection is the only failure that settles the row.
    if (!paystackResult.success && isDefinitePaystackRejection(paystackResult.error)) {
      const message = paystackResult.error?.message ?? 'Paystack refund resubmission failed'
      await tx.refund.update({
        where: { id: refundId },
        data: {
          status: 'FAILED',
          failureReason: message,
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
        },
      })
      return {
        refundId,
        status: 'FAILED' as const,
        paystackRefundId: null,
        paystackStatus: null,
        outcome: 'MARKED_FAILED' as const,
        message: 'Paystack definitively rejected the resubmitted refund, so it was marked failed.',
        eligibleForManualResolution,
        eligibleAt,
      }
    }

    if (!paystackResult.success || !paystackResult.refund) {
      // Indeterminate: the refund may have gone through, so the row stays
      // PENDING, is not linked to a Paystack id, and keeps counting against
      // every cap. Only a short code is stored on the row.
      const note = indeterminateNote(paystackResult.error)
      logWarn('Refund resubmission inconclusive', { refundId, note })
      await tx.refund.update({
        where: { id: refundId },
        data: {
          failureReason: note,
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
        },
      })
      await notifyAdminsRefundNeedsChecking(refund.payment.orderId, [
        { refundId, note },
      ])
      return {
        refundId,
        status: fresh.status,
        paystackRefundId: null,
        paystackStatus: null,
        outcome: 'INDETERMINATE' as const,
        message: `Paystack did not give a definite answer for this refund (${note}). It has been left pending and an administrator has been notified.`,
        eligibleForManualResolution,
        eligibleAt,
      }
    }

    const nextStatus = mapPaystackRefundStatus(paystackResult.refund.status)

    if (nextStatus === null) {
      // A status we do not recognise: keep the row's status, attach nothing,
      // and tell the admins the raw string. Never guess.
      await tx.refund.update({
        where: { id: refundId },
        data: {
          paystackRefundId: null,
          paystackStatus: null,
          failureReason: UNKNOWN_STATUS_NOTE,
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
        },
      })
      await notifyAdminsRefundNeedsChecking(refund.payment.orderId, [
        {
          refundId,
          note: UNKNOWN_STATUS_NOTE,
          unknownPaystackStatus: paystackResult.refund.status,
        },
      ])
      return {
        refundId,
        status: fresh.status,
        paystackRefundId: null,
        paystackStatus: null,
        outcome: 'UNKNOWN_STATUS' as const,
        message: `Paystack reported an unrecognised refund status "${paystackResult.refund.status}" after the resubmission. The refund status was not changed - an administrator has been notified.`,
        eligibleForManualResolution,
        eligibleAt,
      }
    }

    await tx.refund.update({
      where: { id: refundId },
      data: {
        paystackRefundId: String(paystackResult.refund.id),
        paystackStatus: paystackResult.refund.status,
        status: nextStatus,
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
        failureReason: null,
        processedAt: nextStatus === 'PROCESSED' ? new Date() : null,
      },
    })

    await settleOrderIfFullyRefunded(refund.payment.orderId)

    if (nextStatus === 'PROCESSED' && previousFreshStatus !== 'PROCESSED') {
      await notifyRefundProcessed(refundId)
    }

    return {
      refundId,
      status: nextStatus,
      paystackRefundId: String(paystackResult.refund.id),
      paystackStatus: paystackResult.refund.status,
      outcome: 'RESUBMITTED' as const,
      message: 'Refund resubmitted to Paystack under the same record.',
      eligibleForManualResolution,
      eligibleAt,
    }
  })
}

async function notifyAdminsOfAmbiguity(paymentReference: string, refundId: string): Promise<void> {
  const prisma = getPrisma()
  try {
    const superAdmins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    })
    for (const admin of superAdmins) {
      await createNotification(
        admin.id,
        'ORDER_STATUS_UPDATED',
        'Refund needs manual review',
        `Refund ${refundId} on transaction ${paymentReference} matches more than one Paystack refund. Nothing was changed - please review it manually.`
      )
    }
  } catch (error) {
    logError('Failed to notify admins about ambiguous refund', error)
  }
}

/**
 * Tell the super admins that a refund could not be settled and needs a human.
 *
 * The note is a short code (e.g. PAYSTACK_TIMEOUT, UNKNOWN_PAYSTACK_STATUS).
 * The raw Paystack status, when we have one, is included so an admin can act
 * on it, but no refund amount, key material or personal data is ever sent.
 */
async function notifyAdminsRefundNeedsChecking(
  orderId: string,
  entries: { refundId: string; note: string; unknownPaystackStatus?: string }[]
): Promise<void> {
  if (entries.length === 0) return
  const prisma = getPrisma()
  const listed = entries
    .map((entry) =>
      entry.unknownPaystackStatus !== undefined
        ? `refund ${entry.refundId} (Paystack status "${entry.unknownPaystackStatus}")`
        : `refund ${entry.refundId} (${entry.note})`
    )
    .join(', ')
  try {
    const superAdmins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    })
    for (const admin of superAdmins) {
      await createNotification(
        admin.id,
        'ORDER_STATUS_UPDATED',
        'Refund needs manual review',
        `Refunds on order ${orderId} could not be confirmed and were left pending: ${listed}. They have not been marked failed - please check them in Paystack and resolve them from the refund dashboard.`
      )
    }
  } catch (error) {
    logError('Failed to notify admins about a refund that needs checking', error)
  }
}

export async function getRefundHistory(orderId: string): Promise<unknown[]> {
  const prisma = getPrisma()
  return prisma.refund.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
    include: {
      orderItem: { select: { product: { select: { name: true } } } },
    },
  })
}
