import { getPrisma } from '@/lib/prisma'
import { getFeatureRestrictions, SubscriptionPlanName } from './types'

export async function canCreateProduct(vendorId: string): Promise<{ allowed: boolean; current: number; limit: number | null; reason?: string }> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) {
    return { allowed: false, current: 0, limit: 0, reason: 'No active subscription' }
  }
  if (subscription.status !== 'ACTIVE') {
    return { allowed: false, current: 0, limit: 0, reason: `Subscription status is ${subscription.status}` }
  }

  const plan = subscription.plan
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
}

export async function canCreateService(vendorId: string): Promise<{ allowed: boolean; current: number; limit: number | null; reason?: string }> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) {
    return { allowed: false, current: 0, limit: 0, reason: 'No active subscription' }
  }
  if (subscription.status !== 'ACTIVE') {
    return { allowed: false, current: 0, limit: 0, reason: `Subscription status is ${subscription.status}` }
  }

  const plan = subscription.plan
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
}

export async function canUseHomepagePromotions(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  return (await getFeatureRestrictions(subscription.plan.name)).homepagePromotions
}

export async function canUseSponsoredProducts(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  return (await getFeatureRestrictions(subscription.plan.name)).sponsoredProducts
}

export async function canUseSponsoredServices(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  return (await getFeatureRestrictions(subscription.plan.name)).sponsoredServices
}

export async function canUsePremiumAnalytics(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  return (await getFeatureRestrictions(subscription.plan.name)).premiumAnalytics
}

export async function canUseAdvancedAI(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  return (await getFeatureRestrictions(subscription.plan.name)).advancedAI
}

export async function canUseCashbackCampaigns(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  return (await getFeatureRestrictions(subscription.plan.name)).cashbackCampaigns
}

export async function canUseRewardCampaigns(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  return (await getFeatureRestrictions(subscription.plan.name)).rewardCampaigns
}

export async function canUseVendorAdvertisements(vendorId: string): Promise<boolean> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return false
  if (subscription.status !== 'ACTIVE') return false
  return (await getFeatureRestrictions(subscription.plan.name)).vendorAdvertisements
}

export async function getAllFeatureRestrictions(vendorId: string) {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) {
    return getFeatureRestrictions('Free')
  }
  return getFeatureRestrictions(subscription.plan.name)
}