import { getPrisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import { isRefundAlertEnabled } from '@/lib/feature-flags'

const CANCELLATION_AGE_HOURS = 12
const REFUND_AGE_HOURS = 1

type AlertItem = {
  orderId: string | null
  orderRef: string
  source: 'CANCELLATION' | 'REFUND'
  refundAmount: number | null
}

function toGhs(value: any): number | null {
  if (value == null) return null
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber()
  return Number(value)
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(value)
}

export async function runPendingRefundAlerts(now: Date = new Date()) {
  if (!isRefundAlertEnabled()) {
    return { ok: true, skipped: 'flag_off', alerted: 0 }
  }

  const prisma = getPrisma()
  const cancellationCutoff = new Date(now.getTime() - CANCELLATION_AGE_HOURS * 60 * 60 * 1000)
  const refundCutoff = new Date(now.getTime() - REFUND_AGE_HOURS * 60 * 60 * 1000)

  // (a) cancellation refund requests older than 12 hours with no Refund row yet.
  const cancellations = await prisma.customerCancellation.findMany({
    where: {
      refundAlertSentAt: null,
      createdAt: { lt: cancellationCutoff },
    } as any,
    select: { id: true, orderId: true, refundAmount: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const refundedOrderIds = new Set<string>()
  if (cancellations.length > 0) {
    const existingRefunds = await prisma.refund.findMany({
      where: { orderId: { in: cancellations.map((c) => c.orderId) } } as any,
      select: { orderId: true },
    })
    for (const r of existingRefunds) if (r.orderId) refundedOrderIds.add(r.orderId)
  }
  const pendingCancellations = cancellations.filter((c) => !refundedOrderIds.has(c.orderId))

  // (b) Refund rows still PENDING after 1 hour.
  const staleRefunds = await prisma.refund.findMany({
    where: { status: 'PENDING', refundAlertSentAt: null, createdAt: { lt: refundCutoff } } as any,
    select: { id: true, orderId: true, amount: true, createdAt: true },
  })

  const items: AlertItem[] = []
  for (const c of pendingCancellations) {
    items.push({
      orderId: c.orderId,
      orderRef: `#${c.orderId.slice(-8).toUpperCase()}`,
      source: 'CANCELLATION',
      refundAmount: toGhs(c.refundAmount),
    })
  }
  for (const r of staleRefunds) {
    items.push({
      orderId: r.orderId,
      orderRef: r.orderId ? `#${r.orderId.slice(-8).toUpperCase()}` : `refund ${r.id.slice(-8)}`,
      source: 'REFUND',
      refundAmount: toGhs(r.amount),
    })
  }

  // Stamp so an item is never alerted twice.
  if (items.length > 0) {
    await prisma.$transaction(async (tx) => {
      if (pendingCancellations.length > 0) {
        await tx.customerCancellation.updateMany({
          where: { id: { in: pendingCancellations.map((c) => c.id) }, refundAlertSentAt: null } as any,
          data: { refundAlertSentAt: now } as any,
        })
      }
      if (staleRefunds.length > 0) {
        await tx.refund.updateMany({
          where: { id: { in: staleRefunds.map((r) => r.id) }, refundAlertSentAt: null } as any,
          data: { refundAlertSentAt: now } as any,
        })
      }
    })
  }

  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true, email: true, profile: { select: { emailNotifications: true } } },
  })

  const lines = items.map(
    (it) =>
      `${it.orderRef} (${it.source === 'CANCELLATION' ? 'cancellation' : 'refund'})` +
      (it.refundAmount != null ? ` - ${formatAmount(it.refundAmount)}` : '')
  )
  const message =
    `Pending refund alerts: ${items.length} item(s) need attention.\n` + lines.join('\n')
  const subject = `Pending refund alerts - ${items.length} item(s)`
  const textBody =
    `Pending refund alerts: ${items.length} item(s) need attention.\n` + lines.join('\n')

  for (const admin of superAdmins) {
    try {
      await createNotification(admin.id, 'SYSTEM_ALERT', 'Pending refund alerts', message)
    } catch { /* ignore */ }
    const emailEnabled = admin.profile?.emailNotifications ?? true
    if (admin.email && emailEnabled) {
      try {
        await sendEmail({
          to: admin.email,
          subject,
          htmlContent: `<p>${textBody.replace(/\n/g, '<br>')}</p>`,
          textContent: textBody,
          emailType: 'REFUND_ALERT',
        })
      } catch { /* ignore */ }
    }
  }

  // No customer messages, no refund amount changes, no Paystack calls.
  return { ok: true, alerted: items.length }
}
