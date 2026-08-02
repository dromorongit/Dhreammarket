import { getPrisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { subscriptionPlans, planBenefits, getFeatureRestrictions, SubscriptionPlanName } from './types'
import { logInfo, logError } from '@/lib/logger'

export async function getSubscriptionPlans() {
  const prisma = getPrisma()
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
    include: {
      features: {
        select: {
          featureKey: true,
          isEnabled: true,
          limit: true,
        },
      },
    },
  })
  return plans
}

export async function getSubscriptionPlanByName(name: string) {
  const prisma = getPrisma()
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { name },
    include: {
      features: {
        select: {
          featureKey: true,
          isEnabled: true,
          limit: true,
        },
      },
    },
  })
  return plan
}

export async function getVendorSubscription(vendorId: string) {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: {
      plan: true,
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      usageRecords: {
        orderBy: { recordedAt: 'desc' },
        take: 5,
      },
      history: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })
  return subscription
}

export async function createSubscription(vendorId: string, planName: string, billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY') {
  const prisma = getPrisma()
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { name: planName },
  })
  if (!plan) {
    throw new Error(`Subscription plan "${planName}" not found`)
  }

  const now = new Date()
  const periodStart = now
  const periodEnd = new Date(now)
  if (billingCycle === 'YEARLY') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const nextRenewalAt = new Date(periodEnd)

  const subscription = await prisma.vendorSubscription.create({
    data: {
      vendorId,
      planId: plan.id,
      status: 'ACTIVE',
      billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextRenewalAt,
      autoRenew: false,
      totalPaid: 0,
    },
    include: { plan: true },
  })

  await prisma.subscriptionHistory.create({
    data: {
      subscriptionId: subscription.id,
      action: 'SUBSCRIBED',
      toPlanId: plan.id,
      billingCycle,
      notes: `Vendor subscribed to ${planName} plan`,
    },
  })

  logInfo(`Subscription created: vendor=${vendorId}, plan=${planName}, cycle=${billingCycle}`)
  return subscription
}

export async function renewSubscription(subscriptionId: string) {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  })
  if (!subscription) {
    throw new Error('Subscription not found')
  }

  const now = new Date()
  const periodStart = now
  const periodEnd = new Date(now)
  if (subscription.billingCycle === 'YEARLY') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const updated = await prisma.vendorSubscription.update({
    where: { id: subscriptionId },
    data: {
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextRenewalAt: periodEnd,
      status: 'ACTIVE',
      updatedAt: now,
    },
  })

  await prisma.subscriptionHistory.create({
    data: {
      subscriptionId,
      action: 'RENEWED',
      notes: `Subscription renewed for ${subscription.plan.name} plan`,
    },
  })

  logInfo(`Subscription renewed: id=${subscriptionId}`)
  return updated
}

export async function upgradeSubscription(vendorId: string, newPlanName: string, billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY') {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) {
    throw new Error('No active subscription found')
  }

  const newPlan = await prisma.subscriptionPlan.findUnique({
    where: { name: newPlanName },
  })
  if (!newPlan) {
    throw new Error(`Subscription plan "${newPlanName}" not found`)
  }

  const oldPlanId = subscription.planId
  const now = new Date()
  const periodStart = now
  const periodEnd = new Date(now)
  if (billingCycle === 'YEARLY') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const updated = await prisma.vendorSubscription.update({
    where: { id: subscription.id },
    data: {
      planId: newPlan.id,
      billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextRenewalAt: periodEnd,
      status: 'ACTIVE',
      updatedAt: now,
    },
    include: { plan: true },
  })

  await prisma.subscriptionHistory.create({
    data: {
      subscriptionId: subscription.id,
      action: 'UPGRADED',
      fromPlanId: oldPlanId,
      toPlanId: newPlan.id,
      billingCycle,
      notes: `Upgraded from ${subscription.plan.name} to ${newPlanName}`,
    },
  })

  logInfo(`Subscription upgraded: vendor=${vendorId}, from=${subscription.plan.name}, to=${newPlanName}`)
  return updated
}

export async function downgradeSubscription(vendorId: string, newPlanName: string, billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY') {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) {
    throw new Error('No active subscription found')
  }

  const newPlan = await prisma.subscriptionPlan.findUnique({
    where: { name: newPlanName },
  })
  if (!newPlan) {
    throw new Error(`Subscription plan "${newPlanName}" not found`)
  }

  const oldPlanId = subscription.planId
  const now = new Date()
  const periodStart = now
  const periodEnd = new Date(now)
  if (billingCycle === 'YEARLY') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const updated = await prisma.vendorSubscription.update({
    where: { id: subscription.id },
    data: {
      planId: newPlan.id,
      billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextRenewalAt: periodEnd,
      status: 'ACTIVE',
      updatedAt: now,
    },
    include: { plan: true },
  })

  await prisma.subscriptionHistory.create({
    data: {
      subscriptionId: subscription.id,
      action: 'DOWNGRADED',
      fromPlanId: oldPlanId,
      toPlanId: newPlan.id,
      billingCycle,
      notes: `Downgraded from ${subscription.plan.name} to ${newPlanName}`,
    },
  })

  logInfo(`Subscription downgraded: vendor=${vendorId}, from=${subscription.plan.name}, to=${newPlanName}`)
  return updated
}

export async function cancelSubscription(vendorId: string, atPeriodEnd: boolean = true) {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
  })
  if (!subscription) {
    throw new Error('No active subscription found')
  }

  const updated = await prisma.vendorSubscription.update({
    where: { id: subscription.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledAtPeriodEnd: atPeriodEnd,
      updatedAt: new Date(),
    },
  })

  await prisma.subscriptionHistory.create({
    data: {
      subscriptionId: subscription.id,
      action: 'CANCELLED',
      notes: atPeriodEnd ? 'Cancellation at period end' : 'Immediate cancellation',
    },
  })

  logInfo(`Subscription cancelled: vendor=${vendorId}, atPeriodEnd=${atPeriodEnd}`)
  return updated
}

export async function reactivateSubscription(vendorId: string) {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
  })
  if (!subscription) {
    throw new Error('No subscription found')
  }

  const now = new Date()
  const periodStart = now
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const updated = await prisma.vendorSubscription.update({
    where: { id: subscription.id },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextRenewalAt: periodEnd,
      cancelledAt: null,
      cancelledAtPeriodEnd: false,
      updatedAt: now,
    },
  })

  await prisma.subscriptionHistory.create({
    data: {
      subscriptionId: subscription.id,
      action: 'REACTIVATED',
      notes: 'Subscription reactivated',
    },
  })

  logInfo(`Subscription reactivated: vendor=${vendorId}`)
  return updated
}

export async function getUpcomingRenewals(daysAhead: number = 30) {
  const prisma = getPrisma()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + daysAhead)

  const subscriptions = await prisma.vendorSubscription.findMany({
    where: {
      nextRenewalAt: { lte: cutoff },
      status: 'ACTIVE',
    },
    include: {
      vendor: { select: { email: true } },
      plan: { select: { name: true, priceMonthly: true, priceYearly: true } },
    },
    orderBy: { nextRenewalAt: 'asc' },
  })

  return subscriptions.map((s) => ({
    vendorId: s.vendorId,
    vendorName: s.vendor?.email ?? 'Unknown',
    planName: s.plan?.name ?? 'Unknown',
    nextRenewalAt: s.nextRenewalAt,
  }))
}

export async function getExpiredSubscriptions() {
  const prisma = getPrisma()
  const now = new Date()

  const subscriptions = await prisma.vendorSubscription.findMany({
    where: {
      currentPeriodEnd: { lt: now },
      status: { in: ['ACTIVE', 'PAST_DUE'] },
    },
    include: {
      vendor: { select: { email: true } },
      plan: { select: { name: true } },
    },
    orderBy: { currentPeriodEnd: 'asc' },
  })

  return subscriptions.map((s) => ({
    vendorId: s.vendorId,
    vendorName: s.vendor?.email ?? 'Unknown',
    planName: s.plan?.name ?? 'Unknown',
    expiredAt: s.currentPeriodEnd,
  }))
}

export async function getSubscriptionRevenueDashboard() {
  const prisma = getPrisma()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)

  const [monthlyRevenue, yearlyRevenue, totalRevenue, activeCount, planDist] = await Promise.all([
    prisma.subscriptionPayment.aggregate({
      where: {
        status: 'PAID',
        createdAt: { gte: monthStart, lte: now },
      },
      _sum: { amount: true },
    }),
    prisma.subscriptionPayment.aggregate({
      where: {
        status: 'PAID',
        createdAt: { gte: yearStart, lte: now },
      },
      _sum: { amount: true },
    }),
    prisma.subscriptionPayment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    }),
    prisma.vendorSubscription.count({
      where: { status: 'ACTIVE' },
    }),
    prisma.vendorSubscription.groupBy({
      by: ['planId'],
      where: { status: 'ACTIVE' },
      _count: { id: true },
      _sum: { totalPaid: true },
    }),
  ])

  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })
  const planMap = Object.fromEntries(plans.map((p) => [p.id, p.name]))

  return {
    monthlyRevenue: monthlyRevenue._sum.amount ?? 0,
    yearlyRevenue: yearlyRevenue._sum.amount ?? 0,
    totalRevenue: totalRevenue._sum.amount ?? 0,
    activeSubscriptions: activeCount,
    planDistribution: planDist.map((d) => ({
      planName: planMap[d.planId] ?? 'Unknown',
      count: d._count.id,
      totalPaid: d._sum.totalPaid ?? 0,
    })),
  }
}

export async function trackSubscriptionUsage(subscriptionId: string, metric: string, value: number, limit?: number) {
  const prisma = getPrisma()
  const percentage = limit ? Math.min((value / limit) * 100, 100) : 0

  await prisma.subscriptionUsage.upsert({
    where: {
      subscriptionId_metric: {
        subscriptionId,
        metric,
      },
    },
    update: {
      currentValue: value,
      limit,
      percentage,
      recordedAt: new Date(),
    },
    create: {
      subscriptionId,
      metric,
      currentValue: value,
      limit,
      percentage,
    },
  })
}

export async function checkSubscriptionFeatureAccess(vendorId: string, featureKey: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: { include: { features: true } } },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false

  const feature = subscription.plan.features.find((f) => f.featureKey === featureKey)
  if (!feature) return false
  if (!feature.isEnabled) return false
  if (feature.limit !== null && feature.currentUsage >= feature.limit) return false

  return true
}

export async function incrementFeatureUsage(vendorId: string, featureKey: string, increment: number = 1): Promise<void> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: { include: { features: true } } },
  })
  if (!subscription) return

  const feature = subscription.plan.features.find((f) => f.featureKey === featureKey)
  if (!feature) return

  await prisma.subscriptionFeature.update({
    where: { id: feature.id },
    data: { currentUsage: feature.currentUsage + increment },
  })
}

export async function getSubscriptionUsage(vendorId: string) {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { usageRecords: { orderBy: { recordedAt: 'desc' } } },
  })
  if (!subscription) return []

  const plan = subscription.plan
  const productsLimit = plan.productsLimit
  const servicesLimit = plan.servicesLimit

  const productCount = await prisma.product.count({
    where: { store: { userId: vendorId } },
  })
  const serviceCount = await prisma.service.count({
    where: { vendorId },
  })

  return [
    {
      metric: 'products_count',
      currentValue: productCount,
      limit: productsLimit > 0 ? productsLimit : null,
      percentage: productsLimit > 0 ? Math.min((productCount / productsLimit) * 100, 100) : 0,
    },
    {
      metric: 'services_count',
      currentValue: serviceCount,
      limit: servicesLimit > 0 ? servicesLimit : null,
      percentage: servicesLimit > 0 ? Math.min((serviceCount / servicesLimit) * 100, 100) : 0,
    },
  ]
}

export async function generateSubscriptionInvoice(subscriptionId: string): Promise<any> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  })
  if (!subscription) {
    throw new Error('Subscription not found')
  }

  const plan = subscription.plan
  const amount = subscription.billingCycle === 'YEARLY' ? (plan.priceYearly ?? 0) : (plan.priceMonthly ?? 0)
  if (amount <= 0) {
    throw new Error('Free plan does not require invoicing')
  }

  const now = new Date()
  const periodStart = subscription.currentPeriodStart
  const periodEnd = subscription.currentPeriodEnd

  const invoiceNumber = `INV-${subscription.id.slice(0, 8).toUpperCase()}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      subscriptionId,
      invoiceNumber,
      amount,
      periodStart,
      periodEnd,
      status: 'PENDING',
    },
  })

  await prisma.subscriptionHistory.create({
    data: {
      subscriptionId,
      action: 'INVOICE_GENERATED',
      amount,
      notes: `Invoice ${invoiceNumber} generated`,
    },
  })

  logInfo(`Invoice generated: ${invoiceNumber}, amount=${amount}, subscription=${subscriptionId}`)
  return invoice
}

export async function processSubscriptionPayment(invoiceId: string, paystackRef: string, amount: number): Promise<any> {
  const prisma = getPrisma()
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { subscription: true },
  })
  if (!invoice) {
    throw new Error('Invoice not found')
  }

  const payment = await prisma.subscriptionPayment.create({
    data: {
      invoiceId,
      subscriptionId: invoice.subscriptionId,
      amount,
      paystackRef,
      status: 'PAID',
      paymentMethod: 'PAYSTACK',
    },
  })

  await prisma.subscriptionInvoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PAID',
      paystackInvoiceId: paystackRef,
    },
  })

  const subscription = await prisma.vendorSubscription.update({
    where: { id: invoice.subscriptionId },
    data: {
      totalPaid: { increment: amount },
      updatedAt: new Date(),
    },
  })

  await prisma.subscriptionHistory.create({
    data: {
      subscriptionId: invoice.subscriptionId,
      action: 'PAYMENT_SUCCESS',
      amount,
      notes: `Payment received via Paystack reference ${paystackRef}`,
    },
  })

  logInfo(`Payment processed: invoice=${invoiceId}, amount=${amount}, ref=${paystackRef}`)
  return payment
}

export async function getSubscriptionHistory(subscriptionId: string, take: number = 20) {
  const prisma = getPrisma()
  const history = await prisma.subscriptionHistory.findMany({
    where: { subscriptionId },
    orderBy: { createdAt: 'desc' },
    take,
  })
  return history
}