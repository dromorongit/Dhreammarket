import { getPrisma } from '@/lib/prisma'
import { subscriptionPlans } from '@/lib/subscription/types'

export interface SubscriptionRecommendation {
  vendorId: string
  vendorName: string
  currentPlan: string
  recommendedPlan: string
  reason: string
  confidence: number
  estimatedGrowth: string
}

export async function recommendPlanUpgrade(vendorId: string): Promise<SubscriptionRecommendation | null> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return null

  const currentPlanName = subscription.plan?.name ?? 'Free'
  const currentPlanIndex = subscriptionPlans.findIndex((p) => p.name === currentPlanName)
  if (currentPlanIndex >= subscriptionPlans.length - 1) return null

  const nextPlan = subscriptionPlans[currentPlanIndex + 1]

  const productCount = await prisma.product.count({
    where: { store: { userId: vendorId } },
  })
  const serviceCount = await prisma.service.count({
    where: { vendorId },
  })

  const revenue = await prisma.orderItem.aggregate({
    where: {
      product: { store: { userId: vendorId } },
      order: { paymentStatus: 'PAID', createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
    },
    _sum: { grossAmount: true },
  })

  const totalRevenue = revenue._sum.grossAmount ?? 0
  const avgMonthlyRevenue = totalRevenue / 3

  let reason = ''
  let confidence = 0.5

  if (productCount >= (subscription.plan.productsLimit ?? 20) * 0.8) {
    reason = `Approaching product limit (${productCount}/${subscription.plan.productsLimit ?? 20}). Upgrade to ${nextPlan.name} for unlimited products.`
    confidence = 0.9
  } else if (serviceCount >= (subscription.plan.servicesLimit ?? 10) * 0.8) {
    reason = `Approaching service limit (${serviceCount}/${subscription.plan.servicesLimit ?? 10}). Upgrade to ${nextPlan.name} for unlimited services.`
    confidence = 0.9
  } else if (avgMonthlyRevenue > (nextPlan.priceMonthly ?? 0) * 0.5) {
    reason = `Strong revenue (${avgMonthlyRevenue.toFixed(2)} GHS/month). ${nextPlan.name} plan at ${nextPlan.priceMonthly} GHS/month provides good value.`
    confidence = 0.7
  } else {
    reason = `Consider upgrading to ${nextPlan.name} for additional features and benefits.`
    confidence = 0.5
  }

  return {
    vendorId,
    vendorName: vendorId,
    currentPlan: currentPlanName,
    recommendedPlan: nextPlan.name,
    reason,
    confidence,
    estimatedGrowth: `${((nextPlan.priceMonthly ?? 0) / Math.max(avgMonthlyRevenue, 1) * 100).toFixed(1)}% revenue-to-cost ratio`,
  }
}

export async function predictVendorGrowth(vendorId: string): Promise<{
  currentProducts: number
  currentServices: number
  projectedMonthlyGrowth: number
  projectedQuarterlyGrowth: number
  recommendedUpgradeAt: string | null
}> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) {
    return { currentProducts: 0, currentServices: 0, projectedMonthlyGrowth: 0, projectedQuarterlyGrowth: 0, recommendedUpgradeAt: null }
  }

  const currentProducts = await prisma.product.count({
    where: { store: { userId: vendorId } },
  })
  const currentServices = await prisma.service.count({
    where: { vendorId },
  })

  const orders = await prisma.orderItem.findMany({
    where: {
      product: { store: { userId: vendorId } },
      order: { createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
    },
    select: { createdAt: true, quantity: true },
  })

  const monthlyGrowth = orders.length > 0 ? orders.length / 3 : 0
  const quarterlyGrowth = monthlyGrowth * 3

  const plan = subscription.plan
  const productsLimit = plan.productsLimit
  const servicesLimit = plan.servicesLimit

  let recommendedUpgradeAt: string | null = null
  if (productsLimit > 0 && currentProducts > 0) {
    const monthsUntilLimit = Math.floor((productsLimit - currentProducts) / Math.max(monthlyGrowth, 1))
    if (monthsUntilLimit <= 3) {
      recommendedUpgradeAt = `Within ${monthsUntilLimit} month(s) at current growth rate`
    }
  }

  return {
    currentProducts,
    currentServices,
    projectedMonthlyGrowth: Math.round(monthlyGrowth),
    projectedQuarterlyGrowth: Math.round(quarterlyGrowth),
    recommendedUpgradeAt,
  }
}

export async function recommendPremiumFeatures(vendorId: string): Promise<Array<{ feature: string; reason: string; priority: string }>> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) return []

  const planName = subscription.plan?.name ?? 'Free'
  const recommendations: Array<{ feature: string; reason: string; priority: string }> = []

  if (planName === 'Free') {
    recommendations.push({ feature: 'AI Recommendations', reason: 'AI recommendations can improve customer engagement and conversion rates', priority: 'HIGH' })
    recommendations.push({ feature: 'Customer Insights', reason: 'Gain deeper understanding of your customer base', priority: 'MEDIUM' })
  } else if (planName === 'Starter') {
    recommendations.push({ feature: 'Cashback Campaigns', reason: 'Drive repeat purchases and increase customer loyalty', priority: 'HIGH' })
    recommendations.push({ feature: 'Homepage Promotion Credits', reason: 'Increase visibility and attract more customers', priority: 'MEDIUM' })
  } else if (planName === 'Business') {
    recommendations.push({ feature: 'Sponsored Products', reason: 'Boost product visibility in search results', priority: 'HIGH' })
    recommendations.push({ feature: 'Premium AI Forecasting', reason: 'Predict demand and optimize inventory management', priority: 'MEDIUM' })
  } else if (planName === 'Professional') {
    recommendations.push({ feature: 'Featured Vendor Eligibility', reason: 'Stand out as a top vendor on the marketplace', priority: 'HIGH' })
    recommendations.push({ feature: 'API Integrations', reason: 'Connect with external systems and automate workflows', priority: 'MEDIUM' })
  }

  return recommendations
}

export async function getVendorSubscriptionInsights(vendorId: string): Promise<{
  planName: string
  status: string
  billingCycle: string
  totalPaid: number
  productsUsed: number
  productsLimit: number
  servicesUsed: number
  servicesLimit: number
  featuresEnabled: string[]
  upcomingRenewal: string | null
}> {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) {
    return { planName: 'None', status: 'NONE', billingCycle: 'MONTHLY', totalPaid: 0, productsUsed: 0, productsLimit: 0, servicesUsed: 0, servicesLimit: 0, featuresEnabled: [], upcomingRenewal: null }
  }

  const productCount = await prisma.product.count({
    where: { store: { userId: vendorId } },
  })
  const serviceCount = await prisma.service.count({
    where: { vendorId },
  })

  const features = subscription.plan.features
    .filter((f) => f.isEnabled)
    .map((f) => f.featureKey)

  return {
    planName: subscription.plan.name,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    totalPaid: subscription.totalPaid,
    productsUsed: productCount,
    productsLimit: subscription.plan.productsLimit,
    servicesUsed: serviceCount,
    servicesLimit: subscription.plan.servicesLimit,
    featuresEnabled: features,
    upcomingRenewal: subscription.nextRenewalAt?.toISOString() ?? null,
  }
}