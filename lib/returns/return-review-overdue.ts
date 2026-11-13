import { getPrisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { escalate } from './return-service'
import { isBusinessDayReturnReviewEnabled } from '@/lib/feature-flags'

const BATCH_SIZE = 50

export async function runReturnReviewOverdue(now: Date = new Date()) {
  if (!isBusinessDayReturnReviewEnabled()) {
    return { ok: true, skipped: 'flag_off', considered: 0, escalated: 0 }
  }

  const prisma = getPrisma()
  const policy = await prisma.platformPolicy.findUnique({ where: { id: 'singleton' } })
  const cutover = policy?.systemCutoverTimestamp ?? null

  const candidates = await prisma.returnRequest.findMany({
    where: { status: 'PENDING', escalationDeadline: { lt: now } },
    include: {
      orderItem: {
        select: {
          order: { select: { id: true, createdAt: true } },
          product: { select: { store: { select: { userId: true } } } },
        },
      },
    },
    orderBy: { escalationDeadline: 'asc' },
    take: BATCH_SIZE,
  })

  // Only post-cutover orders are governed by the business-day rule.
  const overdue = candidates.filter((rr) => {
    const orderCreated = rr.orderItem.order?.createdAt
    if (!cutover || !orderCreated) return false
    return new Date(orderCreated).getTime() >= new Date(cutover).getTime()
  })

  const escalated: string[] = []
  const vendorOrders = new Map<string, string[]>()

  for (const rr of overdue) {
    // state-machine guards keep this idempotent: PENDING only, deadline passed
    await escalate(prisma, { returnRequestId: rr.id, actor: 'SYSTEM' }, now)
    escalated.push(rr.id)

    const vendorId = rr.orderItem.product?.store?.userId
    if (!vendorId) continue
    const orderRef = `#${rr.orderItem.order.id.slice(-8).toUpperCase()}`
    const list = vendorOrders.get(vendorId) ?? []
    if (!list.includes(orderRef)) list.push(orderRef)
    vendorOrders.set(vendorId, list)
  }

  const orderRefs = overdue.map((rr) => `#${rr.orderItem.order.id.slice(-8).toUpperCase()}`)

  // One combined in-app notification to SUPER_ADMINs per run.
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  })
  const superAdminMessage =
    `Return review overdue: ${orderRefs.length} return request(s) escalated.` +
    (orderRefs.length > 0 ? ` Orders: ${orderRefs.join(', ')}.` : '')
  for (const admin of superAdmins) {
    try {
      await createNotification(admin.id, 'SYSTEM_ALERT', 'Return review overdue', superAdminMessage)
    } catch { /* ignore */ }
  }

  // One in-app notification to each affected vendor per run.
  for (const [vendorId, refs] of vendorOrders) {
    try {
      await createNotification(
        vendorId,
        'ORDER_STATUS_UPDATED',
        'Return needs your response',
        `The following return request(s) were escalated because no response was received before the deadline: ${refs.join(', ')}. Dhream is now reviewing them.`
      )
    } catch { /* ignore */ }
  }

  return { ok: true, considered: candidates.length, escalated: escalated.length }
}
