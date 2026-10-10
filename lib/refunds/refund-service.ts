// Refund service: creating Paystack refunds and reconciling stuck rows.
//
// See lib/refunds/process-refund.ts for the cap/idempotency/wallet rules.
//
// Item caps: a Refund row always belongs to exactly one OrderItem, so every
// call is a single-item refund and the key is exactly the deterministic /
// client-supplied value. Order-level helpers below fan out to one row per item,
// scoping the key with the item id only when more than one item is refunded.
import { getPrisma } from '@/lib/prisma'
import { createPaystackRefund, listPaystackRefunds, type PaystackRefund } from '@/lib/paystack'
import {
  Caps,
  RefundError,
  buildIdempotencyKey,
  canTransition,
  guardWalletOrder,
  mapPaystackRefundStatus,
  round2,
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
import type { RefundStatus } from '@prisma/client'

/** A stuck PENDING refund with no Paystack id is eligible for manual resolution
  * only after this long, so a slow webhook always gets its chance first. */
export const STUCK_REFUND_MIN_AGE_MS = 10 * 60 * 1000

const CREATION_TIME_TOLERANCE_MS = 60_000

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
  return Math.round(Number(storedAmount ?? 0) * 100) === paystackAmount
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
    amount: round2(item.amount ?? caps.itemRemaining(item.orderItemId)),
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
          amount: round2(Number(row.amount)),
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
            amount: round2(Number(existing.amount)),
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
  const unknownStatuses: { refundId: string; paystackStatus: string }[] = []
  for (const row of pending) {
    if (row.alreadyExisted) continue

    const paystackResult = await createPaystackRefund(payment.paystackRef, Math.round(row.amount * 100), {
      currency: 'GHS',
      merchantNote: input.reason,
    })

    if (paystackResult.success && paystackResult.refund) {
      const paystackRefundId = String(paystackResult.refund.id)
      const paystackStatus = paystackResult.refund.status
      const nextStatus = mapPaystackRefundStatus(paystackStatus)

      if (nextStatus === null) {
        // Paystack answered with a status we do not recognise. Record the raw
        // string and the refund id so a later check can reconcile it, but leave
        // the row PENDING and tell the admins - never guess a status.
        await prisma.refund.update({
          where: { id: row.id },
          data: { paystackRefundId, paystackStatus },
        })
        row.paystackRefundId = paystackRefundId
        row.paystackStatus = paystackStatus
        unknownStatuses.push({ refundId: row.id, paystackStatus })
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
    } else {
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
    }
  }

  if (unknownStatuses.length > 0) {
    await notifyAdminsOfUnknownStatuses(input.orderId, unknownStatuses)
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

  const refundedTotal = round2(processedRefunds.reduce((sum, refund) => sum + Number(refund.amount), 0))
  const paymentTotal = round2(Number(latest.payment.amount))

  if (outstanding.length > 0 || refundedTotal < paymentTotal) {
    return false
  }

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

  const listResult = await listPaystackRefunds(refund.payment.paystackRef)
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
      // An unrecognised Paystack status is never guessed at. Attach the id so a
      // later check can reconcile it, but leave the row's status alone and tell
      // the admins the raw string.
      if (!refund.paystackRefundId) {
        await prisma.refund.update({
          where: { id: refundId },
          data: { paystackRefundId: String(match.id), paystackStatus: match.status },
        })
      }
      await notifyAdminsOfUnknownStatuses(refund.payment.orderId, [
        { refundId, paystackStatus: match.status },
      ])
      return {
        refundId,
        status: refund.status,
        paystackRefundId: String(match.id),
        paystackStatus: match.status,
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
      refund.payment.paystackRef as string,
      Math.round(Number(fresh.amount) * 100),
      { merchantNote: fresh.reason ?? undefined }
    )

    if (!paystackResult.success || !paystackResult.refund) {
      const message = paystackResult.error?.message ?? 'Paystack refund resubmission failed'
      logWarn('Refund resubmission failed', { refundId, message })
      throw new RefundError(502, message, 'PAYSTACK_RESUBMIT_FAILED')
    }

    const nextStatus = mapPaystackRefundStatus(paystackResult.refund.status)

    if (nextStatus === null) {
      // A status we do not recognise: keep the raw string, keep the row's
      // status, and tell the admins. Never guess.
      await tx.refund.update({
        where: { id: refundId },
        data: {
          paystackRefundId: String(paystackResult.refund.id),
          paystackStatus: paystackResult.refund.status,
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
        },
      })
      await notifyAdminsOfUnknownStatuses(refund.payment.orderId, [
        { refundId, paystackStatus: paystackResult.refund.status },
      ])
      return {
        refundId,
        status: fresh.status,
        paystackRefundId: String(paystackResult.refund.id),
        paystackStatus: paystackResult.refund.status,
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
 * Tell the super admins that Paystack reported a refund status we do not
 * recognise. The raw status string is included verbatim - we never guess.
 */
async function notifyAdminsOfUnknownStatuses(
  orderId: string,
  entries: { refundId: string; paystackStatus: string }[]
): Promise<void> {
  if (entries.length === 0) return
  const prisma = getPrisma()
  const listed = entries
    .map((entry) => `refund ${entry.refundId} (Paystack status "${entry.paystackStatus}")`)
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
        `Refunds on order ${orderId} reported an unrecognised Paystack status and nothing was changed: ${listed}. Please review them manually.`
      )
    }
  } catch (error) {
    logError('Failed to notify admins about unrecognised refund status', error)
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
