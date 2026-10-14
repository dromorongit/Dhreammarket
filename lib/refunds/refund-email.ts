// One refund confirmation email per Refund row.
//
// The confirmation is tied to the Refund id and to the single transition that
// moved that row into PROCESSED. Because PROCESSED is a terminal state in the
// refund state machine (see canTransition in ./process-refund), a row can only
// enter PROCESSED once, so the caller only ever fires this helper on the update
// that performed that transition.
//
// The in-process set below is a second guard: even if the same transition is
// observed twice inside one process (a webhook and an admin check racing, say)
// the customer still receives exactly one email for that refund.

import { getPrisma } from '@/lib/prisma'
import { sendRefundConfirmationEmail } from '@/lib/email'
import { logError } from '@/lib/logger'
import { pesewasToGhs, toPesewas } from './process-refund'
import { Prisma } from '@prisma/client'

/** Refund ids whose confirmation email has already been sent by this process. */
const sentRefundEmails = new Set<string>()

/** Order ids whose whole-order receipt has already been sent by this process. */
const sentOrderRefundEmails = new Set<string>()

/**
 * True when every pesewa charged has come back, so the order as a whole is
 * settled and the customer needs one receipt rather than one per item.
 *
 * Compares in integer pesewas: a one-pesewa gap is a partial refund and must
 * keep using the per-row emails.
 *
 * Accepts both `number` and Prisma's `Decimal` for the refund amounts.
 */
export function orderIsFullyRefunded(order: {
  paymentStatus?: string | null
  total?: number | null
  refunds?: Array<{ amount: number | Prisma.Decimal }> | null
}): boolean {
  if (!order || order.paymentStatus !== 'REFUNDED') return false
  const paymentPesewas = toPesewas(order.total)
  if (paymentPesewas <= 0) return false
  const refundedPesewas = (order.refunds ?? []).reduce(
    (sum, refund) => sum + toPesewas(refund.amount),
    0
  )
  return refundedPesewas >= paymentPesewas
}

/**
 * Send the refund confirmation email for a single Refund row, exactly once.
 *
 * If the order that row belongs to has settled as a whole, this sends NOTHING
 * and hands the job to notifyOrderRefunded instead, so a multi-item
 * cancellation produces one receipt for the order rather than one email per
 * item. A partial refund keeps using this per-row email.
 *
 * Never throws: a missing customer address or a failing mail provider must not
 * break the refund it belongs to.
 */
export async function notifyRefundProcessed(refundId: string): Promise<void> {
  if (sentRefundEmails.has(refundId)) return

  try {
    const prisma = getPrisma()
    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        orderId: true,
        amount: true,
        currency: true,
        status: true,
        order: {
          select: {
            user: { select: { email: true, profile: { select: { firstName: true } } } },
            paymentStatus: true,
            total: true,
            refunds: {
              where: { status: 'PROCESSED' },
              select: { amount: true },
            },
          },
        },
      },
    })

    // Only a row that actually reached PROCESSED is announced, and only once.
    if (!refund || refund.status !== 'PROCESSED') return

    const email = refund.order?.user?.email
    if (!email) return

    // A whole-order refund is announced once, by the order-level receipt.
    if (refund.order && orderIsFullyRefunded(refund.order)) {
      await notifyOrderRefunded(refund.orderId ?? refund.id)
      return
    }

    // Recorded before the await so a concurrent caller cannot slip a second
    // email in while this one is still in flight.
    sentRefundEmails.add(refund.id)

    const name = refund.order?.user?.profile?.firstName || email.split('@')[0] || 'Customer'
    await sendRefundConfirmationEmail(
      email,
      name,
      refund.orderId ?? refund.id,
      Number(refund.amount),
      refund.currency || 'GHS'
    )
  } catch (error) {
    logError('Failed to send refund confirmation email', error)
  }
}

/** Test seam: forget that this refund was already announced. */
export function resetRefundEmailsForTest(): void {
  sentRefundEmails.clear()
  sentOrderRefundEmails.clear()
}

/**
 * Send ONE order-level receipt when a whole-order refund settles.
 *
 * Why this exists: a cancelled multi-item order creates one Refund row per
 * item, and notifyRefundProcessed fires per row. The customer would therefore
 * receive one email per item for a single cancellation, which reads as several
 * separate refunds. This helper fires once per order, when the order as a
 * whole has settled to REFUNDED.
 *
 * A partial refund never settles the order, so it keeps using the per-row
 * email from notifyRefundProcessed. The two are mutually exclusive: the
 * in-process order set is only populated when the order is fully refunded.
 *
 * Never throws, for the same reason as the per-row helper: a failing mail
 * provider must not break the refund.
 */
export async function notifyOrderRefunded(orderId: string): Promise<void> {
  if (sentOrderRefundEmails.has(orderId)) return

  try {
    const prisma = getPrisma()
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentStatus: true,
        total: true,
        refunds: {
          where: { status: 'PROCESSED' },
          select: { amount: true },
        },
        user: {
          select: { email: true, profile: { select: { firstName: true } } },
        },
      },
    })

    // Both halves of "fully refunded" must hold: the order itself has settled,
    // and the PROCESSED refunds actually cover the amount charged. An order
    // whose refunds are still in flight stays silent.
    if (!order || order.paymentStatus !== 'REFUNDED') return

    const refundedPesewas = order.refunds.reduce((sum, refund) => sum + toPesewas(refund.amount), 0)
    const paymentPesewas = toPesewas(order.total)
    if (paymentPesewas <= 0 || refundedPesewas < paymentPesewas) return

    const email = order.user?.email
    if (!email) return

    // Recorded before the await, exactly as the per-row helper does, so two
    // racing callers cannot send two receipts.
    sentOrderRefundEmails.add(order.id)

    const name = order.user?.profile?.firstName || email.split('@')[0] || 'Customer'
    await sendRefundConfirmationEmail(
      email,
      name,
      order.id,
      pesewasToGhs(refundedPesewas),
      'GHS'
    )
  } catch (error) {
    logError('Failed to send the order refund receipt', error)
  }
}
