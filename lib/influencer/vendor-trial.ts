import { getPrisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

export async function createInfluencerVendorTrial(userId: string, influencerCode: string, prismaClient?: any): Promise<void> {
  const prisma = prismaClient ?? getPrisma()

  const existing = await prisma.vendorSubscription.findUnique({
    where: { vendorId: userId },
  })
  if (existing) {
    return
  }

  const influencer = await prisma.influencer.findUnique({
    where: { referralCode: influencerCode },
    select: { vendorPlan: true, vendorPlanDurationMonths: true, active: true },
  })

  if (!influencer || !influencer.active) {
    return
  }

  const planName = influencer.vendorPlan
  const durationMonths = influencer.vendorPlanDurationMonths

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { name: planName },
  })
  if (!plan) {
    return
  }

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + durationMonths)

  await prisma.vendorSubscription.create({
    data: {
      vendorId: userId,
      planId: plan.id,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextRenewalAt: periodEnd,
      autoRenew: false,
      totalPaid: 0,
      source: 'INFLUENCER',
      influencerCode,
      planExpiresAt: periodEnd,
      notes: `Influencer trial courtesy of ${influencerCode}`,
    },
  })

  createNotification(
    userId,
    'SUBSCRIPTION_ACTIVATED',
    'Starter Plan Activated',
    `You've started on the Starter Plan for your first month, courtesy of ${influencerCode}.`
  ).catch(() => {})
}

export async function notifyExpiringInfluencerTrials(leadDays: number = 5): Promise<{ notified: number }> {
  const prisma = getPrisma()
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() + leadDays)

  const expiring = await prisma.vendorSubscription.findMany({
    where: {
      source: 'INFLUENCER',
      planExpiresAt: { lte: cutoff, gt: now },
      status: { in: ['ACTIVE', 'PAST_DUE'] },
    },
    include: { vendor: { select: { id: true } } },
  })

  let notified = 0
  for (const subscription of expiring) {
    const daysLeft = Math.max(1, Math.ceil(((subscription.planExpiresAt?.getTime() ?? Date.now()) - now.getTime()) / (1000 * 60 * 60 * 24)))
    createNotification(
      subscription.vendorId,
      'SUBSCRIPTION_EXPIRING',
      'Trial Expiring Soon',
      `Your Starter Plan trial courtesy of ${subscription.influencerCode} ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Upgrade to keep your Starter Plan benefits.`
    ).catch(() => {})
    notified++
  }

  return { notified }
}

export async function downgradeExpiredInfluencerTrials(dryRun = false): Promise<{ processed: number }> {
  const prisma = getPrisma()
  const now = new Date()

  const expired = await prisma.vendorSubscription.findMany({
    where: {
      source: 'INFLUENCER',
      planExpiresAt: { lt: now },
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      plan: {
        name: 'Starter',
      },
    },
    include: { plan: true, vendor: true },
  })

  let processed = 0

  for (const subscription of expired) {
    try {
      const freePlan = await prisma.subscriptionPlan.findUnique({
        where: { name: 'Free' },
      })
      if (!freePlan) {
        console.error('Free plan not found during trial downgrade')
        continue
      }

      if (dryRun) {
        processed++
        console.info(`[dryRun] Would downgrade subscription ${subscription.id} for vendor ${subscription.vendorId} to Free`)
        continue
      }

      await prisma.$transaction(async (tx) => {
        await tx.vendorSubscription.update({
          where: { id: subscription.id },
          data: {
            planId: freePlan.id,
            status: 'ACTIVE',
            currentPeriodEnd: now,
            nextRenewalAt: now,
            source: null,
            influencerCode: null,
            planExpiresAt: null,
            updatedAt: now,
          },
        })

        await tx.subscriptionHistory.create({
          data: {
            subscriptionId: subscription.id,
            action: 'DOWNGRADED',
            fromPlanId: subscription.planId,
            toPlanId: freePlan.id,
            billingCycle: subscription.billingCycle,
            notes: 'Influencer trial expired; downgraded to Free plan',
          },
        })

        if (subscription.vendor) {
          createNotification(
            subscription.vendorId,
            'SUBSCRIPTION_EXPIRING',
            'Trial Expired',
            'Your influencer trial has ended and your plan has been moved to the Free plan. Upgrade to keep premium features.'
          ).catch(() => {})
        }
      })

      processed++
    } catch (err) {
      console.error(`Failed to downgrade subscription ${subscription.id} for vendor ${subscription.vendorId}:`, err)
    }
  }

  return { processed }
}
