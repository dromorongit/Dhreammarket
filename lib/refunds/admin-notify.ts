// Tell every SUPER_ADMIN that a refund request is waiting for a decision.
//
// A cancellation no longer refunds anything itself: it records a request and
// the money moves only when a super admin approves it from
// POST /api/admin/refunds. Without this, the only way to notice a waiting
// request is to open the refund request queue and hope.
//
// Everything here is best-effort by design. A notification or email that
// fails must NEVER fail, block or undo the cancellation that triggered it,
// so every call is awaited inside its own try/catch and the errors are only
// logged.

import { getPrisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import { logError } from '@/lib/logger'

/** Shape the two cancellation routes must supply. Kept small and flat. */
export type RefundRequestNotice = {
  /** The cancelled order's id. */
  orderId: string
  /** The order total as charged, in GHS. */
  total: number
  /** The store the cancellation came from, when there is exactly one. */
  storeName: string | null
  /** Which cancellation path produced this request. */
  source: 'CUSTOMER_CANCEL' | 'VENDOR_REJECTION'
}

/**
 * Notify every super admin, in-app and by email, about one waiting refund
 * request.
 *
 * Never throws.
 */
export async function notifySuperAdminsRefundRequested(notice: RefundRequestNotice): Promise<void> {
  try {
    const superAdmins = await getPrisma().user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true, email: true },
    })

    if (superAdmins.length === 0) return

    const orderRef = `#${notice.orderId.slice(-8).toUpperCase()}`
    const sourceLabel =
      notice.source === 'VENDOR_REJECTION' ? 'Vendor rejection' : 'Customer cancellation'

    const formattedAmount = new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(notice.total)

    // No customer email, name, address, phone or payment reference: the
    // message carries only the order reference, the store name and the
    // amount, which is what an admin needs to act on it.
    const storeLabel = notice.storeName ?? 'a store'
    const inAppMessage = `A refund request is waiting for a decision. Order ${orderRef} was cancelled by the customer. Amount ${formattedAmount}. Store: ${storeLabel}. Review it in the refund request queue.`
    const emailSubject = `Refund request waiting - Order ${orderRef}`
    const emailBody = `
      <p>A refund request is waiting for your decision.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600;">Order</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">${orderRef}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600;">Store</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(storeLabel)}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600;">Amount</td>
          <td style="padding: 10px; border: 1px solid #e5e7eb;">${formattedAmount}</td>
        </tr>
      </table>
      <p>Review and decide it from the refund request queue in the admin dashboard.</p>
    `

    for (const admin of superAdmins) {
      // Each notification is independent so one admin's failure does not stop
      // the rest. createNotification already swallows its own errors.
      await createNotification(
        admin.id,
        'SYSTEM_ALERT',
        'Refund request waiting for a decision',
        inAppMessage
      )

      if (!admin.email) continue
      try {
        await sendEmail({
          to: admin.email,
          subject: emailSubject,
          htmlContent: emailBody,
          textContent: `A refund request is waiting for your decision. Order ${orderRef}. Amount ${formattedAmount}. Store: ${storeLabel}.`,
        })
      } catch (emailError) {
        logError('Failed to email a super admin about a refund request', emailError)
      }
    }
  } catch (error) {
    logError('Failed to notify super admins about a refund request', error)
  }
}

/** Minimal HTML escaping for the store name only, which is vendor-supplied. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
