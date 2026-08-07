import { PrismaClient } from '@prisma/client'

export const subscriptionPlans = [
  {
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    productsLimit: 20,
    servicesLimit: 10,
  },
  {
    name: 'Starter',
    priceMonthly: 79,
    priceYearly: 790,
    productsLimit: 100,
    servicesLimit: 40,
  },
  {
    name: 'Business',
    priceMonthly: 199,
    priceYearly: 1990,
    productsLimit: -1,
    servicesLimit: -1,
  },
  {
    name: 'Professional',
    priceMonthly: 399,
    priceYearly: 3990,
    productsLimit: -1,
    servicesLimit: -1,
  },
  {
    name: 'Enterprise',
    priceMonthly: null,
    priceYearly: null,
    productsLimit: -1,
    servicesLimit: -1,
  },
] as const

export type SubscriptionPlanName = typeof subscriptionPlans[number]['name']

export interface PlanBenefits {
  Free: string[]
  Starter: string[]
  Business: string[]
  Professional: string[]
  Enterprise: string[]
}

export const planBenefits: PlanBenefits = {
  Free: [
    'Basic storefront',
    'Basic analytics',
    'Reviews',
    'Messaging',
    'Orders',
    'Bookings',
  ],
  Starter: [
    'Everything in Free',
    'AI recommendations',
    'Customer insights',
    'Coupons',
    'Flash deals',
    'Priority approval',
  ],
  Business: [
    'Everything in Starter',
    'Unlimited listings',
    'Advanced analytics',
    'AI business insights',
    'Cashback campaigns',
    'Reward campaigns',
    'Homepage promotion credits',
  ],
  Professional: [
    'Everything in Business',
    'Featured Vendor eligibility',
    'Sponsored Products',
    'Sponsored Services',
    'Homepage promotions',
    'Premium AI forecasting',
    'Inventory forecasting',
    'Seasonal demand prediction',
    'Priority search ranking',
  ],
  Enterprise: [
    'Everything',
    'Dedicated account manager',
    'API integrations',
    'Multiple staff accounts',
    'Multiple branches',
    'Custom reporting',
    'Priority support',
  ],
}

export interface FeatureRestrictions {
  productLimits: boolean
  serviceLimits: boolean
  homepagePromotions: boolean
  sponsoredProducts: boolean
  sponsoredServices: boolean
  premiumAnalytics: boolean
  advancedAI: boolean
  cashbackCampaigns: boolean
  rewardCampaigns: boolean
  vendorAdvertisements: boolean
  campaignCreation: boolean
  sponsoredSearchBoost: boolean
  categoryBoosts: boolean
  vendorSpotlight: boolean
  priorityApproval: boolean
  unlimitedCampaigns: boolean
}

export function getFeatureRestrictions(planName: string): FeatureRestrictions {
  switch (planName) {
    case 'Free':
      return {
        productLimits: true,
        serviceLimits: true,
        homepagePromotions: false,
        sponsoredProducts: false,
        sponsoredServices: false,
        premiumAnalytics: false,
        advancedAI: false,
        cashbackCampaigns: false,
        rewardCampaigns: false,
        vendorAdvertisements: false,
        campaignCreation: false,
        sponsoredSearchBoost: false,
        categoryBoosts: false,
        vendorSpotlight: false,
        priorityApproval: false,
        unlimitedCampaigns: false,
      }
    case 'Starter':
      return {
        productLimits: true,
        serviceLimits: true,
        homepagePromotions: false,
        sponsoredProducts: false,
        sponsoredServices: false,
        premiumAnalytics: false,
        advancedAI: true,
        cashbackCampaigns: false,
        rewardCampaigns: false,
        vendorAdvertisements: false,
        campaignCreation: false,
        sponsoredSearchBoost: false,
        categoryBoosts: false,
        vendorSpotlight: false,
        priorityApproval: false,
        unlimitedCampaigns: false,
      }
    case 'Business':
      return {
        productLimits: false,
        serviceLimits: false,
        homepagePromotions: true,
        sponsoredProducts: false,
        sponsoredServices: false,
        premiumAnalytics: true,
        advancedAI: true,
        cashbackCampaigns: true,
        rewardCampaigns: true,
        vendorAdvertisements: false,
        campaignCreation: false,
        sponsoredSearchBoost: false,
        categoryBoosts: false,
        vendorSpotlight: false,
        priorityApproval: false,
        unlimitedCampaigns: false,
      }
    case 'Professional':
      return {
        productLimits: false,
        serviceLimits: false,
        homepagePromotions: true,
        sponsoredProducts: true,
        sponsoredServices: true,
        premiumAnalytics: true,
        advancedAI: true,
        cashbackCampaigns: true,
        rewardCampaigns: true,
        vendorAdvertisements: true,
        campaignCreation: true,
        sponsoredSearchBoost: true,
        categoryBoosts: true,
        vendorSpotlight: false,
        priorityApproval: false,
        unlimitedCampaigns: false,
      }
    case 'Enterprise':
      return {
        productLimits: false,
        serviceLimits: false,
        homepagePromotions: true,
        sponsoredProducts: true,
        sponsoredServices: true,
        premiumAnalytics: true,
        advancedAI: true,
        cashbackCampaigns: true,
        rewardCampaigns: true,
        vendorAdvertisements: true,
        campaignCreation: true,
        sponsoredSearchBoost: true,
        categoryBoosts: true,
        vendorSpotlight: true,
        priorityApproval: true,
        unlimitedCampaigns: true,
      }
    default:
      return getFeatureRestrictions('Free')
  }
}

export interface SubscriptionDashboardData {
  subscriptionId: string
  currentPlan: string
  subscriptionStatus: string
  startDate: string | null
  endDate: string | null
  nextRenewal: string | null
  productsRemaining: number
  servicesRemaining: number
  billingHistory: Array<{
    id: string
    invoiceNumber: string
    amount: number
    status: string
    periodStart: string
    periodEnd: string
    createdAt: string
  }>
  usage: Array<{
    metric: string
    currentValue: number
    limit: number | null
    percentage: number
  }>
  plans: Array<{
    name: string
    priceMonthly: number | null
    priceYearly: number | null
    productsLimit: number
    servicesLimit: number
    benefits: string[]
    restrictions: {
      productLimits: boolean
      serviceLimits: boolean
      homepagePromotions: boolean
      sponsoredProducts: boolean
      sponsoredServices: boolean
      premiumAnalytics: boolean
      advancedAI: boolean
      cashbackCampaigns: boolean
      rewardCampaigns: boolean
      vendorAdvertisements: boolean
      campaignCreation: boolean
      sponsoredSearchBoost: boolean
      categoryBoosts: boolean
      vendorSpotlight: boolean
      priorityApproval: boolean
      unlimitedCampaigns: boolean
    }
  }>
}

export interface SubscriptionAnalyticsData {
  totalRevenue: number
  mrr: number
  arr: number
  activeSubscriptions: number
  planDistribution: Record<string, number>
  topPayingVendors: Array<{
    vendorId: string
    vendorName: string
    planName: string
    totalPaid: number
  }>
  churnRate: number
  renewalRate: number
  upcomingRenewals: Array<{
    vendorId: string
    vendorName: string
    planName: string
    nextRenewalAt: string
  }>
  expiredSubscriptions: Array<{
    vendorId: string
    vendorName: string
    planName: string
    expiredAt: string
  }>
}