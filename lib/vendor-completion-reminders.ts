import { getPrisma } from '@/lib/prisma'
import { formatNotificationMessage } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import { isVendorCompletionReminderEnabled } from '@/lib/feature-flags'

export const VENDOR_COMPLETION_REMINDER_TITLE = 'Mark delivered orders as completed'

// Single shared wording for the vendor completion reminder. {orderCount} is
// substituted with the number of orders due in this run. No payout time and
// no amounts are stated.
export const VENDOR_COMPLETION_REMINDER_BODY =
  'You have {orderCount} order(s) marked delivered. Once the buyer has received the product, mark the order as completed so your payout can be processed.'

export const VENDOR_COMPLETION_REMINDER_EMAIL_SUBJECT = 'Mark your delivered orders as completed'

const BATCH_SIZE = 50
const REMINDER_1_HOURS = 24
const REMINDER_2_HOURS = 72
const NOTIFICATION_TYPE = 'ORDER_STATUS_UPDATED'
const EMAIL_TYPE = 'COMPLETION_REMINDER'

interface OrderCandidate {
  orderId: string
  reminder1: boolean
  reminder2: boolean
  vendorIds: string[]
}

interface VendorEntry {
  orderIds: string[]
  reminder1Ids: string[]
  reminder2Ids: string[]
}

export async function runVendorCompletionReminders(now: Date = new Date()) {
  if (!isVendorCompletionReminderEnabled()) {
    return { sent: 0, considered: 0, skipped: 'flag_off' }
  }

  const prisma = getPrisma()

  const policy = await prisma.platformPolicy.findUnique({
    where: { id: 'singleton' },
  })
  const cutover = policy?.systemCutoverTimestamp
  if (!cutover) {
    return { sent: 0, considered: 0, skipped: 'cutover_unset' }
  }

  const reminder1Cutoff = new Date(now.getTime() - REMINDER_1_HOURS * 60 * 60 * 1000)
  const reminder2Cutoff = new Date(now.getTime() - REMINDER_2_HOURS * 60 * 60 * 1000)

  // Order has no order-level deliveredAt; delivery is stamped per item
  // (lib/order-delivery-stamps.ts), so the order's delivery time is the
  // latest deliveredAt among its items.
  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      status: 'DELIVERED',
      completedAt: null,
      createdAt: { gte: cutover },
      OR: [{ completionReminder1At: null }, { completionReminder2At: null }],
    },
    include: {
      items: {
        where: { deliveredAt: { not: null } },
        select: {
          deliveredAt: true,
          product: { select: { store: { select: { userId: true } } } },
        },
      },
    },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  })

  const candidates: OrderCandidate[] = []
  for (const order of orders) {
    let latestDelivered = 0
    const vendorIds = new Set<string>()
    for (const item of order.items) {
      const d = item.deliveredAt ? new Date(item.deliveredAt).getTime() : 0
      if (d > latestDelivered) latestDelivered = d
      const vendorId = item.product?.store?.userId
      if (vendorId) vendorIds.add(vendorId)
    }
    if (!latestDelivered) continue

    const reminder1 =
      order.completionReminder1At === null && latestDelivered <= reminder1Cutoff.getTime()
    const reminder2 =
      order.completionReminder2At === null && latestDelivered <= reminder2Cutoff.getTime()
    if (reminder1 || reminder2) {
      candidates.push({ orderId: order.id, reminder1, reminder2, vendorIds: [...vendorIds] })
    }
  }

  if (candidates.length === 0) {
    return { sent: 0, considered: orders.length }
  }

  // Group due orders by vendor. One combined message per vendor per run.
  const vendorMap = new Map<string, VendorEntry>()
  for (const c of candidates) {
    for (const vendorId of c.vendorIds) {
      let entry = vendorMap.get(vendorId)
      if (!entry) {
        entry = { orderIds: [], reminder1Ids: [], reminder2Ids: [] }
        vendorMap.set(vendorId, entry)
      }
      if (!entry.orderIds.includes(c.orderId)) entry.orderIds.push(c.orderId)
      if (c.reminder1 && !entry.reminder1Ids.includes(c.orderId)) entry.reminder1Ids.push(c.orderId)
      if (c.reminder2 && !entry.reminder2Ids.includes(c.orderId)) entry.reminder2Ids.push(c.orderId)
    }
  }

  const vendorIds = [...vendorMap.keys()]
  const users = await prisma.user.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, email: true, profile: { select: { emailNotifications: true } } },
  })
  const settings = await prisma.vendorSettings.findMany({
    where: { userId: { in: vendorIds } },
    select: { userId: true, notifyNewOrders: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))
  const settingsMap = new Map(settings.map((s) => [s.userId, s]))

  let sent = 0
  for (const [vendorId, entry] of vendorMap) {
    const setting = settingsMap.get(vendorId)
    // Respect existing in-app opt-out (vendorSettings.notifyNewOrders, default on).
    if (setting?.notifyNewOrders === false) continue

    const orderCount = entry.orderIds.length
    const body = formatNotificationMessage(VENDOR_COMPLETION_REMINDER_BODY, { orderCount })
    const orderList = entry.orderIds.map((id) => `#${id.slice(0, 8)}`).join(', ')
    const message = `${body}\n\nOrders: ${orderList}`

    // Stamp the reminder timestamps in the same transaction as creating the
    // in-app notification so an order can never be reminded twice.
    await prisma.$transaction(async (tx) => {
      await tx.notification.create({
        data: {
          userId: vendorId,
          type: NOTIFICATION_TYPE,
          title: VENDOR_COMPLETION_REMINDER_TITLE,
          message,
        },
      })
      if (entry.reminder1Ids.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: entry.reminder1Ids }, completionReminder1At: null },
          data: { completionReminder1At: now },
        })
      }
      if (entry.reminder2Ids.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: entry.reminder2Ids }, completionReminder2At: null },
          data: { completionReminder2At: now },
        })
      }
    })

    // Email, respecting the email opt-out (profile.emailNotifications, default on).
    const user = userMap.get(vendorId)
    const emailEnabled = user?.profile?.emailNotifications ?? true
    const email = user?.email
    if (email && emailEnabled) {
      try {
        await sendEmail({
          to: email,
          subject: VENDOR_COMPLETION_REMINDER_EMAIL_SUBJECT,
          htmlContent: `<p>${message.replace(/\n/g, '<br>')}</p>`,
          textContent: message,
          emailType: EMAIL_TYPE,
        })
      } catch (emailError) {
        console.error(`[Vendor Completion Reminders] Email failed for vendor ${vendorId}:`, emailError)
      }
    }

    sent += 1
  }

  return { sent, considered: orders.length }
}
