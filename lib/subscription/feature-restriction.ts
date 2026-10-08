import { getPrisma } from '@/lib/prisma'
import { getFeatureRestrictions, SubscriptionPlanName } from './types'
import { getSubscriptionPlanByName, ensureFreeSubscription } from './subscription-service'
import { logError } from '@/lib/logger'

export function isExpiredInfluencerTrial(subscription: {
  source: string | null
  planExpiresAt: Date | null
  plan: { name: string } | null
}): boolean {
  return (
    subscription.source === 'INFLUENCER' &&
    subscription.planExpiresAt !== null &&
    subscription.planExpiresAt < new Date() &&
    subscription.plan?.name === 'Starter'
  )
}

export async function getEffectivePlanName(vendorId: string): Promise<string> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return 'Free'
  if (isExpiredInfluencerTrial(subscription)) return 'Free'
  return subscription.plan?.name ?? 'Free'
}

export async function canCreateProduct(vendorId: string): Promise<{ allowed: boolean; current: number; limit: number | null; reason?: string }> {
  const prisma = getPrisma()
  try {
    let subscription = await prisma.vendorSubscription.findUnique({
      where: { vendorId },
      include: { plan: true },
    })

    if (!subscription) {
      subscription = await ensureFreeSubscription(vendorId)
    }

    if (!subscription || subscription.status !== 'ACTIVE') {
      return { allowed: false, current: 0, limit: 0, reason: `Subscription status is ${subscription?.status ?? 'none'}` }
    }

    const expiredInfluencerTrial = isExpiredInfluencerTrial(subscription)
    const effectivePlan = expiredInfluencerTrial ? await getSubscriptionPlanByName('Free') : subscription.plan
    const plan = effectivePlan ?? subscription.plan

    const restrictions = await getFeatureRestrictions(plan.name)
    const productCount = await prisma.product.count({
      where: { store: { userId: vendorId } },
    })

    if (restrictions.productLimits && plan.productsLimit > 0 && productCount >= plan.productsLimit) {
      return {
        allowed: false,
        current: productCount,
        limit: plan.productsLimit,
        reason: `Product limit of ${plan.productsLimit} reached for ${plan.name} plan`,
      }
    }

    return { allowed: true, current: productCount, limit: plan.productsLimit > 0 ? plan.productsLimit : null }
  } catch (error) {
    logError('Failed to evaluate canCreateProduct; failing open to avoid platform-wide vendor block', error, { vendorId })
    return { allowed: true, current: 0, limit: null, reason: 'Subscription check temporarily unavailable' }
  }
}

export async function canCreateService(vendorId: string): Promise<{ allowed: boolean; current: number; limit: number | null; reason?: string }> {
  const prisma = getPrisma()
  try {
    let subscription = await prisma.vendorSubscription.findUnique({
      where: { vendorId },
      include: { plan: true },
    })

    if (!subscription) {
      subscription = await ensureFreeSubscription(vendorId)
    }

    if (!subscription || subscription.status !== 'ACTIVE') {
      return { allowed: false, current: 0, limit: 0, reason: `Subscription status is ${subscription?.status ?? 'none'}` }
    }

    const expiredInfluencerTrial = isExpiredInfluencerTrial(subscription)
    const effectivePlan = expiredInfluencerTrial ? await getSubscriptionPlanByName('Free') : subscription.plan
    const plan = effectivePlan ?? subscription.plan

    const restrictions = await getFeatureRestrictions(plan.name)
    const serviceCount = await prisma.service.count({
      where: { vendorId },
    })

    if (restrictions.serviceLimits && plan.servicesLimit > 0 && serviceCount >= plan.servicesLimit) {
      return {
        allowed: false,
        current: serviceCount,
        limit: plan.servicesLimit,
        reason: `Service limit of ${plan.servicesLimit} reached for ${plan.name} plan`,
      }
    }

    return { allowed: true, current: serviceCount, limit: plan.servicesLimit > 0 ? plan.servicesLimit : null }
  } catch (error) {
    logError('Failed to evaluate canCreateService; failing open to avoid platform-wide vendor block', error, { vendorId })
    return { allowed: true, current: 0, limit: null, reason: 'Subscription check temporarily unavailable' }
  }
}

export async function canUseHomepagePromotions(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  const planName = isExpiredInfluencerTrial(subscription) ? 'Free' : subscription.plan.name
  return (await getFeatureRestrictions(planName)).homepagePromotions
}

export async function canUseSponsoredProducts(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  const planName = isExpiredInfluencerTrial(subscription) ? 'Free' : subscription.plan.name
  return (await getFeatureRestrictions(planName)).sponsoredProducts
}

export async function canUseSponsoredServices(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  const planName = isExpiredInfluencerTrial(subscription) ? 'Free' : subscription.plan.name
  return (await getFeatureRestrictions(planName)).sponsoredServices
}

export async function canUsePremiumAnalytics(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  const planName = isExpiredInfluencerTrial(subscription) ? 'Free' : subscription.plan.name
  return (await getFeatureRestrictions(planName)).premiumAnalytics
}

export async function canUseAdvancedAI(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  const planName = isExpiredInfluencerTrial(subscription) ? 'Free' : subscription.plan.name
  return (await getFeatureRestrictions(planName)).advancedAI
}

export async function canUseCashbackCampaigns(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  const planName = isExpiredInfluencerTrial(subscription) ? 'Free' : subscription.plan.name
  return (await getFeatureRestrictions(planName)).cashbackCampaigns
}

export async function canUseRewardCampaigns(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  const planName = isExpiredInfluencerTrial(subscription) ? 'Free' : subscription.plan.name
  return (await getFeatureRestrictions(planName)).rewardCampaigns
}

export async function canUseVendorAdvertisements(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  const planName = isExpiredInfluencerTrial(subscription) ? 'Free' : subscription.plan.name
  return (await getFeatureRestrictions(planName)).vendorAdvertisements
}

export async function getAllFeatureRestrictions(vendorId: string) {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) {
    return await getFeatureRestrictions('Free')
  }
  if (isExpiredInfluencerTrial(subscription)) {
    return await getFeatureRestrictions('Free')
  }
  return await getFeatureRestrictions(subscription.plan.name)
}