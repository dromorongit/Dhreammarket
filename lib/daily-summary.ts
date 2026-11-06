// Scheduled daily sales summary for vendors (in-app only).
//
// Composes the library functions the vendor sales-summary route already uses
// (prisma order/product reads, loadVendorReceivables, accra day helpers) and
// sends a single in-app notification per vendor per day.
//
// The order's day is decided by `createdAt` in Africa/Accra (see
// lib/sales-summary.ts accraDayStart/accraDayEndExclusive), not by the payment
// date. "Today" therefore means the Accra calendar day that contains `now`.
//
// Scope: a sale is counted only when paymentStatus is PAID or the order source
// is MANUAL (same base scope as /api/vendor/orders), so abandoned online
// checkouts never appear in today's figures.

import { getPrisma } from '@/lib/prisma'
import {
  accraDayStart,
  accraDayEndExclusive,
  ACCRA_TIME_ZONE,
  getZonedParts,
  PROFIT_LABEL,
  fromPesewas,
  toPesewas,
  resolveUnitCostPesawas,
  type SalesSource,
} from '@/lib/sales-summary'
import { createNotification } from '@/lib/notifications'
import { sendVendorDailySummaryEmail } from '@/lib/email'
import { loadVendorReceivables } from '@/lib/vendor-sales-data'

export const DAILY_SUMMARY_HOUR = 19

interface DailySummaryMetrics {
  ordersToday: number
  paidSalesGHS: number
  profitGHS: number
  ordersToDispatch: number
  receivablesGHS: number
}

function ghs(amount: number): string {
  return `GHS ${amount.toFixed(2)}`
}

function buildMessage(m: DailySummaryMetrics): string {
  const lines: string[] = []
  lines.push(`Orders today: ${m.ordersToday}`)
  if (m.paidSalesGHS > 0) lines.push(`Paid sales (orders placed today): ${ghs(m.paidSalesGHS)}`)
  lines.push(`${PROFIT_LABEL}: ${ghs(m.profitGHS)}`)
  if (m.ordersToDispatch > 0) lines.push(`Orders to dispatch: ${m.ordersToDispatch}`)
  if (m.receivablesGHS > 0) lines.push(`Unpaid receivables: ${ghs(m.receivablesGHS)}`)
  return lines.slice(0, 5).join('\n')
}

async function computeMetrics(
  prisma: ReturnType<typeof getPrisma>,
  storeId: string,
  todayStart: Date,
  todayEnd: Date,
): Promise<DailySummaryMetrics> {
  // Today's counted orders for this store's products: paid sales and manual
  // orders only (same base scope as /api/vendor/orders), not cancelled and not
  // deleted. Abandoned online checkouts are excluded.
  const todayOrders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      status: { not: 'CANCELLED' },
      OR: [{ paymentStatus: 'PAID' }, { source: 'MANUAL' }],
      createdAt: { gte: todayStart, lt: todayEnd },
      items: { some: { product: { storeId } } },
    },
    select: {
      id: true,
      total: true,
      paymentStatus: true,
      status: true,
      source: true,
      deliveryCost: true,
      items: {
        select: {
          quantity: true,
          costPriceSnapshot: true,
          product: { select: { costPrice: true } },
          productVariant: { select: { costPrice: true } },
        },
      },
    },
  })

  let ordersToday = 0
  let paidSalesGHS = 0
  let revenuePesawas = 0
  let cogsPesawas = 0
  let deliveryCostPesawas = 0

  for (const order of todayOrders) {
    // Base scope: paid sales and manual orders only; abandoned online
    // checkouts are excluded.
    if (order.paymentStatus !== 'PAID' && order.source !== 'MANUAL') continue
    ordersToday += 1
    const isPaid = order.paymentStatus === 'PAID'
    if (!isPaid) continue
    paidSalesGHS += Number(order.total)
    revenuePesawas += toPesewas(Number(order.total))
    if (order.deliveryCost != null) {
      deliveryCostPesawas += toPesewas(Number(order.deliveryCost))
    }
    for (const item of order.items || []) {
      const unitCost = resolveUnitCostPesawas(
        { source: order.source as SalesSource },
        {
          costPriceSnapshot: item.costPriceSnapshot ?? null,
          variantCostPrice: item.productVariant?.costPrice ?? null,
          productCostPrice: item.product?.costPrice ?? null,
        },
      )
      if (unitCost === null) continue
      cogsPesawas += unitCost * Number(item.quantity)
    }
  }

  // Orders to dispatch: ALL PROCESSING orders for the store, not only today's.
  const processingCount = await prisma.order.count({
    where: {
      deletedAt: null,
      status: 'PROCESSING',
      items: { some: { product: { storeId } } },
    },
  })

  // Unpaid receivables, all time (manual sales still pending).
  const receivables = await loadVendorReceivables(storeId, new Date())
  const receivablesGHS = receivables.amountPesawas / 100

  const profitPesawas = revenuePesawas - cogsPesawas - deliveryCostPesawas
  const profitGHS = fromPesewas(profitPesawas)

  return {
    ordersToday,
    paidSalesGHS,
    profitGHS,
    ordersToDispatch: processingCount,
    receivablesGHS,
  }
}

export type DailySummaryResult =
  | { skipped: 'before_send_time' }
  | { considered: number; sent: number; quiet: number; failed: number }

export async function runDailySummaries(now: Date = new Date()): Promise<DailySummaryResult> {
  const prisma = getPrisma()

  const hour = getZonedParts(now, ACCRA_TIME_ZONE).hour
  if (hour < DAILY_SUMMARY_HOUR) {
    return { skipped: 'before_send_time' }
  }

  const todayStart = accraDayStart(now)
  const todayEnd = accraDayEndExclusive(now)

  // One grouped query: stores with order activity today or PROCESSING orders,
  // excluding vendors who already received today's summary (lastDailySummaryDate
  // on or after today's Accra start) and vendors who opted out
  // (notifyDailySummary false). Vendors without a VendorSettings row use the
  // defaults (notifyDailySummary = true, lastDailySummaryDate = null) and remain
  // candidates so they are never starved out of the 50-per-run cap.
  const candidateStores = await prisma.store.findMany({
    where: {
      user: {
        role: 'VENDOR',
        OR: [
          { vendorSettings: null },
          {
            vendorSettings: {
              AND: [
                { notifyDailySummary: true },
                {
                  OR: [
                    { lastDailySummaryDate: { lt: todayStart } },
                    { lastDailySummaryDate: null },
                  ],
                },
              ],
            },
          },
        ],
      },
      OR: [
        {
          products: {
            some: {
              orderItems: {
                some: {
                  order: {
                    deletedAt: null,
                    status: { not: 'CANCELLED' },
                    createdAt: { gte: todayStart, lt: todayEnd },
                  },
                },
              },
            },
          },
        },
        {
          products: {
            some: {
              orderItems: {
                some: {
                  order: {
                    status: 'PROCESSING',
                  },
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true, userId: true, name: true },
    take: 50,
    orderBy: { id: 'asc' },
  })

  const vendorIds = candidateStores.map((s) => s.userId).filter(Boolean) as string[]
  const settingsRows = await prisma.vendorSettings.findMany({
    where: { userId: { in: vendorIds } },
    select: { userId: true, notifyDailySummary: true, lastDailySummaryDate: true },
  })
  const settingsMap = new Map(settingsRows.map((s) => [s.userId, s]))

  const users = await prisma.user.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, email: true, profile: { select: { emailNotifications: true } } },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  let considered = 0
  let sent = 0
  let quiet = 0
  let failed = 0

  for (const store of candidateStores) {
    const userId = store.userId
    if (!userId) continue
    considered += 1

    // Vendors with no VendorSettings row use the defaults (notifyDailySummary = true).
    const settings = settingsMap.get(userId)
    if (settings?.notifyDailySummary === false) {
      quiet += 1
      continue
    }

    // Remember the previous claim date so a failed send can roll back and be
    // retried on the next hourly run.
    const previousDate = settings?.lastDailySummaryDate ?? null

    // Atomic claim: at most one summary per vendor per Accra day.
    let claimed = false
    const updated = await prisma.vendorSettings.updateMany({
      where: {
        userId,
        OR: [
          { lastDailySummaryDate: null },
          { lastDailySummaryDate: { lt: todayStart } },
        ],
      },
      data: { lastDailySummaryDate: now },
    })
    if (updated.count > 0) {
      claimed = true
    } else {
      const existing = await prisma.vendorSettings.findUnique({
        where: { userId },
        select: { lastDailySummaryDate: true },
      })
      if (!existing) {
        await prisma.vendorSettings.create({
          data: { userId, lastDailySummaryDate: now },
        })
        claimed = true
      }
    }

    if (!claimed) {
      quiet += 1
      continue
    }

    try {
      const metrics = await computeMetrics(prisma, store.id, todayStart, todayEnd)
      if (metrics.ordersToday === 0 && metrics.ordersToDispatch === 0) {
        quiet += 1
        continue
      }

      const message = buildMessage(metrics)
      await createNotification(userId, 'DAILY_SUMMARY', 'Daily sales summary', message)

      const user = userMap.get(userId)
      const email = user?.email
      const emailNotifications = user?.profile?.emailNotifications ?? true
      if (email && emailNotifications) {
        try {
          await sendVendorDailySummaryEmail(email, store.name ?? userId, message)
        } catch (emailError) {
          // Email failure must never affect the in-app notification or other vendors.
          console.error(`[Daily Summary] Email failed for vendor ${userId}:`, emailError)
        }
      }

      sent += 1
    } catch (error) {
      console.error(`[Daily Summary] Failed for vendor ${userId}:`, error)
      // Roll back the claim so the next hourly run retries this vendor.
      try {
        await prisma.vendorSettings.update({
          where: { userId },
          data: { lastDailySummaryDate: previousDate },
        })
      } catch {
        // best-effort rollback
      }
      failed += 1
    }
  }

  return { considered, sent, quiet, failed }
}
