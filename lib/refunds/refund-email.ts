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

/** Refund ids whose confirmation email has already been sent by this process. */
const sentRefundEmails = new Set<string>()

/**
 * Send the refund confirmation email for a single Refund row, exactly once.
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
          },
        },
      },
    })

    // Only a row that actually reached PROCESSED is announced, and only once.
    if (!refund || refund.status !== 'PROCESSED') return

    const email = refund.order?.user?.email
    if (!email) return

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
}
