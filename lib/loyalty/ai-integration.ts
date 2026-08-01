import { getPrisma } from '@/lib/prisma'
import { LoyaltyEngine } from '@/lib/loyalty/loyalty-engine'
import type { RecommendationResult } from '@/lib/ai/types'

interface PersonalizedRewardOffer {
  id: string
  type: 'POINTS_BONUS' | 'CASHBACK_BONUS' | 'COUPON' | 'TIER_BOOST' | 'EXCLUSIVE_OFFER'
  title: string
  description: string
  value: number
  pointsBonus?: number
  cashbackBonus?: number
  expiresAt: string
  reason: string
  score: number
}

export async function getPersonalizedRewardOffers(userId: string): Promise<PersonalizedRewardOffer[]> {
  const prisma = getPrisma()
  const offers: PersonalizedRewardOffer[] = []

  const loyalty = await prisma.customerLoyalty.findUnique({
    where: { userId },
    include: { tier: true },
  })

  if (!loyalty) return offers

  const points = loyalty.points
  const tier = loyalty.tier
  const lifetimeOrders = loyalty.lifetimeOrders
  const lifetimeBookings = loyalty.lifetimeBookings
  const lifetimeReviews = loyalty.lifetimeReviews

  if (points > 0 && points < 100) {
    offers.push({
      id: `offer-points-bonus-${userId}`,
      type: 'POINTS_BONUS',
      title: 'Points Bonus',
      description: 'Earn double points on your next purchase!',
      value: 50,
      pointsBonus: 50,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'Low points balance - bonus offer to encourage engagement',
      score: 0.9,
    })
  }

  if (tier && tier.name === 'Bronze' && lifetimeOrders >= 2) {
    offers.push({
      id: `offer-tier-boost-${userId}`,
      type: 'TIER_BOOST',
      title: 'Silver Tier Boost',
      description: 'You are close to Silver tier! Earn bonus points to upgrade.',
      value: 100,
      pointsBonus: 100,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'Close to next tier - boost offer',
      score: 0.85,
    })
  }

  if (lifetimeReviews >= 3 && tier) {
    offers.push({
      id: `offer-cashback-bonus-${userId}`,
      type: 'CASHBACK_BONUS',
      title: 'Cashback Bonus',
      description: `Earn ${(tier.cashbackRate * 100).toFixed(1)}% cashback on your next purchase!`,
      value: tier.cashbackRate * 100,
      cashbackBonus: tier.cashbackRate * 100,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'Active reviewer - cashback bonus',
      score: 0.8,
    })
  }

  if (lifetimeOrders >= 5) {
    offers.push({
      id: `offer-exclusive-${userId}`,
      type: 'EXCLUSIVE_OFFER',
      title: 'Exclusive Loyalty Offer',
      description: 'As a valued customer, enjoy an exclusive discount on your next order!',
      value: 15,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'Frequent shopper - exclusive offer',
      score: 0.75,
    })
  }

  if (lifetimeBookings >= 3) {
    offers.push({
      id: `offer-service-bonus-${userId}`,
      type: 'POINTS_BONUS',
      title: 'Service Booking Bonus',
      description: 'Earn extra points on your next service booking!',
      value: 30,
      pointsBonus: 30,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'Frequent service booker - bonus offer',
      score: 0.7,
    })
  }

  offers.sort((a, b) => b.score - a.score)

  return offers
}

export async function getAIRewardSuggestions(userId: string): Promise<RecommendationResult[]> {
  const prisma = getPrisma()
  const loyalty = await prisma.customerLoyalty.findUnique({
    where: { userId },
    include: { tier: true },
  })

  if (!loyalty) return []

  const suggestions: RecommendationResult[] = []

  if (loyalty.tier) {
    suggestions.push({
      id: `reward-suggestion-tier-${loyalty.tier.id}`,
      name: `Upgrade to ${loyalty.tier.name} Tier`,
      slug: `loyalty-tier-${loyalty.tier.slug}`,
      reason: `You are close to ${loyalty.tier.name} tier`,
      type: 'VENDOR',
      score: 0.8,
    })
  }

  const topCategories = await prisma.recommendation.findMany({
    where: { userId, reason: 'PURCHASED' },
    select: { entityType: true, entityId: true, score: true },
    orderBy: { score: 'desc' },
    take: 5,
  })

  for (const rec of topCategories) {
    suggestions.push({
      id: `reward-suggestion-${rec.entityId}`,
      name: `Earn more points with ${rec.entityType}`,
      slug: rec.entityId,
      reason: 'Based on your purchase history',
      type: rec.entityType as any,
      score: rec.score,
    })
  }

  return suggestions
}