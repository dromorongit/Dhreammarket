import { getPrisma } from '@/lib/prisma'
import { getFeatureRestrictions, SubscriptionPlanName } from '@/lib/subscription/types'

export async function canVendorCreateCampaign(vendorId: string): Promise<{ allowed: boolean; reason?: string }> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })

  if (!subscription) {
    return { allowed: false, reason: 'No active subscription found' }
  }

  if (subscription.status !== 'ACTIVE') {
    return { allowed: false, reason: `Subscription status is ${subscription.status}` }
  }

  const restrictions = getFeatureRestrictions(subscription.plan.name)

  if (!restrictions.vendorAdvertisements) {
    return {
      allowed: false,
      reason: `Your ${subscription.plan.name} plan does not include advertising capabilities. Upgrade to Professional or Enterprise plan.`,
    }
  }

  return { allowed: true }
}

export async function getVendorCampaignLimit(vendorId: string): Promise<{ maxCampaigns: number; currentCampaigns: number }> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })

  if (!subscription) {
    return { maxCampaigns: 0, currentCampaigns: 0 }
  }

  const plan = subscription.plan
  const isEnterprise = plan.name === 'Enterprise'
  const maxCampaigns = isEnterprise ? -1 : 5

  const currentCampaigns = await getConsumedCampaignSlots(prisma, vendorId)

  return {
    maxCampaigns: maxCampaigns === -1 ? -1 : maxCampaigns,
    currentCampaigns,
  }
}

export async function getConsumedCampaignSlots(prisma: any, vendorId: string): Promise<number> {
  return prisma.advertisementCampaign.count({
    where: {
      vendorId,
      campaignStatus: {
        in: ['ACTIVE', 'PENDING_APPROVAL'],
      },
    },
  })
}

export async function getSubscriptionPlanFeatures(vendorId: string): Promise<{
  canCreateCampaigns: boolean
  maxCampaigns: number
  canUseSponsoredProducts: boolean
  canUseSponsoredServices: boolean
  canUseSearchBoost: boolean
  canUseHomeplacements: boolean
  canUseTrendingBoosts: boolean
  canUseFeaturedPlacements: boolean
  canUseVendorSpotlight: boolean
  canUsePriorityApproval: boolean
}> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })

  if (!subscription || subscription.status !== 'ACTIVE') {
    return {
      canCreateCampaigns: false,
      maxCampaigns: 0,
      canUseSponsoredProducts: false,
      canUseSponsoredServices: false,
      canUseSearchBoost: false,
      canUseHomeplacements: false,
      canUseTrendingBoosts: false,
      canUseFeaturedPlacements: false,
      canUseVendorSpotlight: false,
      canUsePriorityApproval: false,
    }
  }

  const restrictions = getFeatureRestrictions(subscription.plan.name)
  const isEnterprise = subscription.plan.name === 'Enterprise'

  return {
    canCreateCampaigns: true,
    maxCampaigns: isEnterprise ? -1 : 5,
    canUseSponsoredProducts: restrictions.sponsoredProducts || isEnterprise,
    canUseSponsoredServices: restrictions.sponsoredServices || isEnterprise,
    canUseSearchBoost: restrictions.sponsoredProducts || restrictions.sponsoredServices || isEnterprise,
    canUseHomeplacements: restrictions.homepagePromotions || isEnterprise,
    canUseTrendingBoosts: restrictions.homepagePromotions || isEnterprise,
    canUseFeaturedPlacements: restrictions.homepagePromotions || isEnterprise,
    canUseVendorSpotlight: isEnterprise,
    canUsePriorityApproval: isEnterprise,
  }
}