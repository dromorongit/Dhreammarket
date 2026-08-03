import { getPrisma } from '@/lib/prisma'
import { getAIEngine } from '@/lib/ai/rule-based-engine'
import { AIEngine } from '@/lib/ai/types'
import type { AdvertisementCampaignData, AdvertisementCampaignType } from './types'

export interface CampaignRecommendation {
  campaignType: AdvertisementCampaignType
  recommendedProductId?: string
  recommendedServiceId?: string
  recommendedSection?: string
  suggestedDuration: number
  suggestedPrice: number
  expectedUplift: number
  confidence: number
  reason: string
}

export async function recommendCampaignForVendor(vendorId: string): Promise<CampaignRecommendation[]> {
  const prisma = getPrisma()
  const recommendations: CampaignRecommendation[] = []

  const vendorProducts = await prisma.product.findMany({
    where: { store: { userId: vendorId } },
    select: { id: true, name: true, slug: true, price: true, salesCount: true, averageRating: true, stock: true },
    orderBy: { salesCount: 'desc' },
    take: 10,
  })

  const vendorServices = await prisma.service.findMany({
    where: { vendorId },
    select: { id: true, title: true, slug: true, startingPrice: true, serviceRequests: { select: { id: true, status: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const topProducts = vendorProducts.filter((p) => p.salesCount > 0 && p.stock > 0).slice(0, 5)
  const topServices = vendorServices.filter((s) => s.serviceRequests.length > 0).slice(0, 5)

  for (const product of topProducts) {
    const expectedUplift = product.salesCount * 0.15
    const suggestedPrice = Math.round(product.price * 0.1 * 100) / 100
    const confidence = Math.min(product.salesCount / 100, 1)

    recommendations.push({
      campaignType: 'SPONSORED_PRODUCT',
      recommendedProductId: product.id,
      recommendedSection: 'Sponsored',
      suggestedDuration: 7,
      suggestedPrice,
      expectedUplift,
      confidence,
      reason: `Product "${product.name}" has ${product.salesCount} sales - strong candidate for sponsored placement`,
    })
  }

  for (const service of topServices) {
    const expectedUplift = service.serviceRequests.length * 0.1
    const suggestedPrice = Math.round(Number(service.startingPrice) * 0.1 * 100) / 100
    const confidence = Math.min(service.serviceRequests.length / 50, 1)

    recommendations.push({
      campaignType: 'SPONSORED_SERVICE',
      recommendedServiceId: service.id,
      recommendedSection: 'Sponsored',
      suggestedDuration: 7,
      suggestedPrice,
      expectedUplift,
      confidence,
      reason: `Service "${service.title}" has ${service.serviceRequests.length} bookings - good candidate for sponsored placement`,
    })
  }

  const trendingProducts = await prisma.product.findMany({
    where: { stock: { gt: 0 }, OR: [{ availabilityType: 'IN_STOCK' }, { availabilityType: 'PREORDER' }] },
    select: { id: true, name: true, slug: true, price: true, salesCount: true, averageRating: true },
    orderBy: { salesCount: 'desc' },
    take: 5,
  })

  for (const product of trendingProducts) {
    const suggestedPrice = Math.round(product.price * 0.15 * 100) / 100
    recommendations.push({
      campaignType: 'TRENDING_NOW_BOOST',
      recommendedProductId: product.id,
      recommendedSection: 'Trending Now',
      suggestedDuration: 3,
      suggestedPrice,
      expectedUplift: product.salesCount * 0.2,
      confidence: 0.7,
      reason: `Product "${product.name}" is trending with ${product.salesCount} sales - boost for Trending Now section`,
    })
  }

  const trendingServices = await prisma.service.findMany({
    where: { status: 'PUBLISHED', isActive: true, availabilityStatus: 'AVAILABLE' },
    select: { id: true, title: true, slug: true, startingPrice: true, serviceRequests: { select: { id: true, status: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  for (const service of trendingServices) {
    const completedBookings = service.serviceRequests.filter((r) => r.status === 'COMPLETED').length
    const suggestedPrice = Math.round(Number(service.startingPrice) * 0.15 * 100) / 100
    recommendations.push({
      campaignType: 'TRENDING_SERVICE_BOOST',
      recommendedServiceId: service.id,
      recommendedSection: 'Trending Services',
      suggestedDuration: 3,
      suggestedPrice,
      expectedUplift: completedBookings * 0.15,
      confidence: 0.6,
      reason: `Service "${service.title}" is trending with ${completedBookings} completed bookings`,
    })
  }

  return recommendations.sort((a, b) => b.confidence - a.confidence)
}

export async function predictCampaignSuccess(
  campaignType: AdvertisementCampaignType,
  productId?: string,
  serviceId?: string
): Promise<{ successProbability: number; expectedViews: number; expectedClicks: number; expectedRevenue: number }> {
  const prisma = getPrisma()

  let baseViews = 100
  let baseClicks = 10
  let baseRevenue = 0

  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { salesCount: true, averageRating: true, price: true },
    })
    if (product) {
      baseViews = product.salesCount * 10 + 50
      baseClicks = Math.round(baseViews * 0.1)
      baseRevenue = product.price * product.salesCount * 0.05
    }
  }

  if (serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { serviceRequests: { select: { id: true, status: true } }, startingPrice: true },
    })
    if (service) {
      const completedBookings = service.serviceRequests.filter((r) => r.status === 'COMPLETED').length
      baseViews = completedBookings * 15 + 30
      baseClicks = Math.round(baseViews * 0.12)
      baseRevenue = Number(service.startingPrice) * completedBookings * 0.08
    }
  }

  const successProbability = Math.min(0.95, 0.3 + (baseClicks / Math.max(baseViews, 1)) * 0.5)

  return {
    successProbability,
    expectedViews: Math.round(baseViews),
    expectedClicks: Math.round(baseClicks),
    expectedRevenue: Math.round(baseRevenue * 100) / 100,
  }
}

export async function suggestCampaignDuration(
  campaignType: AdvertisementCampaignType,
  price: number
): Promise<{ suggestedDuration: number; reason: string }> {
  const durationMap: Record<AdvertisementCampaignType, { baseDays: number; pricePerDay: number }> = {
    SPONSORED_PRODUCT: { baseDays: 7, pricePerDay: 50 },
    SPONSORED_SERVICE: { baseDays: 7, pricePerDay: 50 },
    TRENDING_NOW_BOOST: { baseDays: 3, pricePerDay: 30 },
    TRENDING_SERVICE_BOOST: { baseDays: 3, pricePerDay: 30 },
    FEATURED_PRODUCT_PLACEMENT: { baseDays: 14, pricePerDay: 75 },
    FEATURED_SERVICE_PLACEMENT: { baseDays: 14, pricePerDay: 75 },
    SEARCH_RESULT_BOOST: { baseDays: 7, pricePerDay: 40 },
    CATEGORY_BOOST: { baseDays: 10, pricePerDay: 45 },
    VENDOR_SPOTLIGHT: { baseDays: 14, pricePerDay: 100 },
  }

  const config = durationMap[campaignType] || { baseDays: 7, pricePerDay: 50 }
  const suggestedDuration = Math.max(1, Math.round(price / config.pricePerDay))

  return {
    suggestedDuration: Math.min(suggestedDuration, 30),
    reason: `Based on ${campaignType} pricing of ${config.pricePerDay}/day and your budget of ${price}`,
  }
}

export async function suggestBestHomepageSection(
  campaignType: AdvertisementCampaignType
): Promise<string> {
  const sectionMap: Record<AdvertisementCampaignType, string> = {
    SPONSORED_PRODUCT: 'Sponsored',
    SPONSORED_SERVICE: 'Sponsored',
    TRENDING_NOW_BOOST: 'Trending Now',
    TRENDING_SERVICE_BOOST: 'Trending Services',
    FEATURED_PRODUCT_PLACEMENT: 'Featured Products',
    FEATURED_SERVICE_PLACEMENT: 'Featured Services',
    SEARCH_RESULT_BOOST: 'Sponsored',
    CATEGORY_BOOST: 'Trending Now',
    VENDOR_SPOTLIGHT: 'Featured Products',
  }

  return sectionMap[campaignType] || 'Sponsored'
}