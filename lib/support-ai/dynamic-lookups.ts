import { getPrisma } from '@/lib/prisma'
import type { OrderStatusResult, VendorPayoutResult, VendorOnboardingResult } from './types'

export async function lookupOrderStatus(
  userId: string,
  orderReference?: string
): Promise<OrderStatusResult[]> {
  const prisma = getPrisma()

  const where: { userId: string; deletedAt?: null; id?: { contains: string } } = { userId }

  if (orderReference && orderReference.trim().length > 0) {
    const ref = orderReference.trim()
    where.id = { contains: ref }
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      total: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  return orders.map((o) => ({
    orderId: o.id,
    status: o.status,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    itemCount: o._count.items,
  }))
}

export async function lookupVendorPayoutStatus(
  vendorId: string
): Promise<{ recentPayouts: VendorPayoutResult[]; subscription: VendorOnboardingResult | null }> {
  const prisma = getPrisma()

  const [payouts, subscription] = await Promise.all([
    prisma.vendorPayout.findMany({
      where: { vendorId },
      select: {
        id: true,
        amount: true,
        status: true,
        paidAt: true,
        createdAt: true,
        note: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.vendorSubscription.findFirst({
      where: { vendorId },
      select: {
        id: true,
        status: true,
        planId: true,
        billingCycle: true,
        currentPeriodEnd: true,
        nextRenewalAt: true,
        trialEndsAt: true,
        autoRenew: true,
      },
    }),
  ])

  const recentPayouts: VendorPayoutResult[] = payouts.map((p) => ({
    payoutId: p.id,
    amount: p.amount,
    status: p.status,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    note: p.note,
  }))

  const onboarding: VendorOnboardingResult | null = subscription
    ? {
        subscriptionId: subscription.id,
        status: subscription.status,
        planId: subscription.planId,
        billingCycle: subscription.billingCycle,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        nextRenewalAt: subscription.nextRenewalAt.toISOString(),
        trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
        autoRenew: subscription.autoRenew,
      }
    : null

  return { recentPayouts, subscription: onboarding }
}

export function formatOrderStatusMessage(results: OrderStatusResult[]): string {
  if (results.length === 0) {
    return 'No orders found for your account. If you just placed an order, it may take a few minutes to appear. Browse your orders in your Dashboard > Orders.'
  }

  if (results.length === 1) {
    const o = results[0]
    return `Order #${o.orderId.slice(-8)} — Status: ${o.status} | Payment: ${o.paymentStatus} | Fulfillment: ${o.fulfillmentStatus} | Total: GHS ${o.total.toFixed(2)} | ${o.itemCount} item(s) | Placed: ${new Date(o.createdAt).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' })}. View full details in your Dashboard > Orders.`
  }

  const lines = results.map(
    (o) =>
      `• #${o.orderId.slice(-8)} — ${o.status} | Paid: ${o.paymentStatus} | GHS ${o.total.toFixed(2)} | ${new Date(o.createdAt).toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })}`
  )
  return `You have ${results.length} recent orders:\n${lines.join('\n')}\n\nView full details in your Dashboard > Orders.`
}

export function formatVendorPayoutMessage(data: {
  recentPayouts: VendorPayoutResult[]
  subscription: VendorOnboardingResult | null
}): string {
  const parts: string[] = []

  if (data.subscription) {
    const s = data.subscription
    parts.push(
      `Subscription: ${s.status} | Plan: ${s.planId} | Billing: ${s.billingCycle} | Auto-renew: ${s.autoRenew ? 'Yes' : 'No'} | Period ends: ${new Date(s.currentPeriodEnd).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' })}${s.trialEndsAt ? ` | Trial ends: ${new Date(s.trialEndsAt).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}`
    )
  } else {
    parts.push('No active subscription found. You may need to complete vendor onboarding.')
  }

  if (data.recentPayouts.length === 0) {
    parts.push('No payouts have been processed yet. Payouts are typically processed monthly after sales are reconciled.')
  } else {
    parts.push(`Recent payouts (${data.recentPayouts.length}):`)
    for (const p of data.recentPayouts) {
      const paidInfo = p.paidAt
        ? `Paid on ${new Date(p.paidAt).toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' })}`
        : 'Not yet paid'
      parts.push(`• GHS ${p.amount.toFixed(2)} — ${p.status} | ${paidInfo}${p.note ? ` | Note: ${p.note}` : ''}`)
    }
  }

  return parts.join('\n')
}
