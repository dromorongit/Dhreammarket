// Paystack refund webhook handling (Part A, design gate amendment 3)
//
// Flow:
//  1. Verify the signature on the RAW body first.
//  2. Read the transaction reference defensively
//     (data.transaction_reference OR data.transaction.reference).
//  3. Re-fetch the authoritative refund list from Paystack
//     (GET /refund?reference=<transaction reference>).
//  4. Reconcile ALL our Refund rows that belong to this payment against that
//     authoritative list:
//       - match by stored Paystack refund id when we have one;
//       - otherwise by amount AND creation time, and only attach when exactly
//         one candidate matches;
//       - if that match is ambiguous, change NOTHING and notify the admins;
//       - if Paystack reports a status we do not recognise, change NOTHING and
//         notify the admins with the raw status string.
//  5. Apply monotonic state transitions only.
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPrisma } from '@/lib/prisma'
import { listPaystackRefunds, type PaystackRefund } from '@/lib/paystack'
import { canTransition, mapPaystackRefundStatus, round2, toPesewas } from '@/lib/refunds/process-refund'
import { notifyRefundProcessed } from '@/lib/refunds/refund-email'
import { createAuditLog } from '@/lib/audit-log'
import { createNotification } from '@/lib/notifications'
import { logWarn, logError, logInfo } from '@/lib/logger'
import type { RefundStatus } from '@prisma/client'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

// Two of our rows created milliseconds apart, plus up to a minute of clock
// skew between us and Paystack, should not collide with a wrong refund.
const CREATION_TIME_TOLERANCE_MS = 60_000

function verifyPaystackSignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false
  if (!PAYSTACK_SECRET_KEY) return false

  const expectedSignature = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch {
    return false
  }
}

// Re-exported so callers (and the tests) have one canonical status mapper.
export { mapPaystackRefundStatus }

type ReconcileSummary = {
  reconciled: number
  attached: number
  unchanged: number
  ambiguous: string[]
  unmatched: string[]
  unknown: { refundId: string; paystackStatus: string }[]
}

/**
 * True when the event name is a refund lifecycle event we handle.
 */
export function isRefundEvent(event: string | undefined): boolean {
  return typeof event === 'string' && event.startsWith('refund.')
}

function readTransactionReference(data: Record<string, any> | undefined): string | null {
  if (!data) return null
  const direct = typeof data.transaction_reference === 'string' ? data.transaction_reference.trim() : ''
  if (direct) return direct
  const nested = data.transaction && typeof data.transaction.reference === 'string'
    ? data.transaction.reference.trim()
    : ''
  return nested || null
}

function amountMatches(storedAmount: unknown, paystackAmount: number): boolean {
  // Exact decimal conversion to pesewas, never a float multiply.
  return toPesewas(storedAmount as number | string) === paystackAmount
}

function creationTimeMatches(stored: Date | null, paystackCreatedAt: string | null): boolean {
  if (!stored || !paystackCreatedAt) return false
  const storedMs = new Date(stored).getTime()
  const paystackMs = new Date(paystackCreatedAt).getTime()
  if (!Number.isFinite(storedMs) || !Number.isFinite(paystackMs)) return false
  return Math.abs(storedMs - paystackMs) <= CREATION_TIME_TOLERANCE_MS
}

/**
 * A reference truncated for logging. A Paystack transaction reference is a
 * business identifier, so it is shortened before it reaches the logs and no
 * payload, amount or customer data is logged with it.
 */
function truncateReference(reference: string): string {
  const compact = reference.length > 12 ? reference.slice(0, 12) + '...' : reference
  return compact
}

/**
 * Reconcile every Refund row attached to a payment against Paystack's
 * authoritative refund list for that transaction.
 */
export async function reconcileRefundsForPayment(
  paymentId: string,
  paystackRefunds: PaystackRefund[]
): Promise<ReconcileSummary> {
  const prisma = getPrisma()
  const summary: ReconcileSummary = {
    reconciled: 0,
    attached: 0,
    unchanged: 0,
    ambiguous: [],
    unmatched: [],
    unknown: [],
  }

  const refunds = await prisma.refund.findMany({
    where: { paymentId, status: { in: ['PENDING', 'PROCESSING', 'NEEDS_ATTENTION'] } },
  })

  for (const refund of refunds) {
    let match: PaystackRefund | undefined

    if (refund.paystackRefundId) {
      match = paystackRefunds.find((r) => String(r.id) === String(refund.paystackRefundId))
      if (!match) {
        // The refund we recorded is no longer in Paystack's list. Leave it
        // untouched rather than guessing a different refund.
        summary.unmatched.push(refund.id)
        continue
      }
    } else {
      const candidates = paystackRefunds.filter(
        (r) =>
          amountMatches(refund.amount, r.amount) &&
          creationTimeMatches(refund.createdAt, r.createdAt)
      )
      if (candidates.length === 1) {
        match = candidates[0]
      } else if (candidates.length > 1) {
        summary.ambiguous.push(refund.id)
        continue
      } else {
        summary.unmatched.push(refund.id)
        continue
      }
    }

    const nextStatus = mapPaystackRefundStatus(match.status)
    if (nextStatus === null) {
      // Paystack reported a status we do not recognise. Never guess: the row is
      // left exactly as it is and a human is told the raw string.
      summary.unknown.push({ refundId: refund.id, paystackStatus: match.status })
      continue
    }

    const isNewlyAttached = !refund.paystackRefundId

    const isTerminal = nextStatus === 'PROCESSED' || nextStatus === 'FAILED'

    // Monotonic states: never move a refund backwards in the state machine.
    if (!canTransition(refund.status, nextStatus)) {
      summary.unchanged += 1
      continue
    }

    // The single transition into PROCESSED is what announces the refund.
    const becameProcessed = nextStatus === 'PROCESSED' && refund.status !== 'PROCESSED'

    await prisma.refund.update({
      where: { id: refund.id },
      data: {
        ...(isNewlyAttached ? { paystackRefundId: String(match.id) } : {}),
        paystackStatus: match.status,
        status: nextStatus,
        processedAt: isTerminal && !refund.processedAt ? new Date() : refund.processedAt,
      },
    })
    summary.reconciled += 1
    if (isNewlyAttached) summary.attached += 1

    if (becameProcessed) {
      await notifyRefundProcessed(refund.id)
    }
  }

  return summary
}

async function notifyAdmins(message: string): Promise<void> {
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
        'Refund reconciliation needs attention',
        message
      )
    }
  } catch (error) {
    logError('[Refund Webhook] Failed to notify admins', error)
  }
}

export async function handleRefundWebhook(
  body: string,
  signature: string | undefined
): Promise<NextResponse> {
  // 1. Verify the signature on the RAW body first. This is the ONLY rejection
  //    path: everything below is an unprocessable but successfully received
  //    event, which Paystack must not retry.
  if (!verifyPaystackSignature(body, signature)) {
    logWarn('[Refund Webhook] Invalid signature - rejecting webhook')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let parsedBody: { event?: string; data?: Record<string, any> }
  try {
    parsedBody = JSON.parse(body)
  } catch {
    logWarn('[Refund Webhook] Unparseable refund event body', { event: undefined })
    return NextResponse.json({ received: true, reconciled: 0 }, { status: 200 })
  }

  // 2. Read the transaction reference defensively.
  const transactionReference = readTransactionReference(parsedBody.data)
  if (!transactionReference) {
    logWarn('[Refund Webhook] Missing or unreadable transaction reference; acknowledging', {
      event: parsedBody.event,
    })
    return NextResponse.json({ received: true, reconciled: 0 }, { status: 200 })
  }

  const prisma = getPrisma()
  let payment: { id: string; orderId: string | null; amount: number | string | null } | null
  try {
    payment = await prisma.payment.findUnique({
      where: { reference: transactionReference },
      select: { id: true, orderId: true, amount: true },
    })
  } catch (error) {
    // A database failure is the only unexpected error worth retrying.
    logError('[Refund Webhook] Payment lookup failed', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!payment) {
    logWarn('[Refund Webhook] No payment row for the refund event reference; acknowledging', {
      event: parsedBody.event,
      referencePrefix: truncateReference(transactionReference),
    })
    return NextResponse.json({ received: true, reconciled: 0 }, { status: 200 })
  }

  // Captured so the later order update has a plain string id.
  const paymentOrderId = payment.orderId ?? ''

  // 3. Re-fetch the authoritative refund list. A Paystack failure here is an
  //    upstream error, not a rejection: tell Paystack to retry.
  const listResult = await listPaystackRefunds(transactionReference)
  if (!listResult.success) {
    logError('[Refund Webhook] Unable to list Paystack refunds', new Error(listResult.error?.message ?? 'unknown'))
    return NextResponse.json({ error: listResult.error?.message ?? 'Failed to list refunds' }, { status: 502 })
  }

  const paystackRefunds = listResult.refunds
  if (paystackRefunds.length === 0) {
    logInfo('[Refund Webhook] No refunds reported by Paystack', {
      referencePrefix: truncateReference(transactionReference),
    })
    return NextResponse.json({ received: true, reconciled: 0 })
  }

  // 4. Reconcile every row for this payment.
  let summary: ReconcileSummary
  try {
    summary = await reconcileRefundsForPayment(payment.id, paystackRefunds)
  } catch (error) {
    // A database failure mid-reconciliation is retryable.
    logError('[Refund Webhook] Reconciliation failed', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (summary.ambiguous.length > 0) {
    await notifyAdmins(
      `Refund reconciliation for transaction ${transactionReference} found more than one matching Paystack refund. No changes were applied - review manually.`
    )
  }

  if (summary.unknown.length > 0) {
    const listed = summary.unknown
      .map((entry) => `refund ${entry.refundId} (Paystack status "${entry.paystackStatus}")`)
      .join(', ')
    await notifyAdmins(
      `Refund reconciliation for transaction ${transactionReference} saw an unrecognised Paystack refund status and changed nothing: ${listed}. Please review these refunds manually.`
    )
  }

  if (summary.reconciled > 0 || summary.ambiguous.length > 0 || summary.unknown.length > 0) {
    await createAuditLog({
      userId: paymentOrderId,
      userRole: 'SYSTEM',
      action: 'ORDER_REFUNDED',
      entityType: 'ORDER',
      entityId: paymentOrderId,
      afterData: {
        source: 'PAYSTACK_REFUND_WEBHOOK',
        event: parsedBody.event,
        transactionReference,
        ...summary,
      },
    })
  }

  // 5. Settle the order only once the PROCESSED refunds cover the whole
  //    payment. A partial refund (or a refund still outstanding) leaves the
  //    order PAID.
  let paymentStatusUpdated = false
  if (summary.reconciled > 0) {
    const refreshedRefunds = await prisma.refund.findMany({
      where: { paymentId: payment.id },
      select: { amount: true, status: true },
    })
    const processedPesewas = refreshedRefunds
      .filter((r) => r.status === 'PROCESSED')
      .reduce((sum, r) => sum + toPesewas(r.amount), 0)
    const paymentAmountPesewas = toPesewas(payment.amount)
    const outstanding = refreshedRefunds.filter(
      (r) => r.status !== 'PROCESSED' && r.status !== 'FAILED'
    )
    if (outstanding.length === 0 && processedPesewas >= paymentAmountPesewas) {
      await prisma.order.update({
        where: { id: paymentOrderId },
        data: { paymentStatus: 'REFUNDED' },
      })
      paymentStatusUpdated = true
    }
  }

  return NextResponse.json({
    received: true,
    event: parsedBody.event,
    ...summary,
    paymentStatusUpdated,
  })
}
