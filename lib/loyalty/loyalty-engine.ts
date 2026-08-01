import { getPrisma } from '@/lib/prisma'
import { earnPoints, redeemPoints, getPointsBalance, getPointsHistory, adjustPoints } from './reward-engine'
import { earnCashback, redeemCashback, getCashbackBalance, getCashbackHistory, getCashbackForOrder } from './cashback-engine'
import { createReferral, completeReferral, claimReferralReward, getReferralStats, getReferralLeaderboard } from './referral-engine'
import { checkAchievement, unlockAchievement, getUserAchievements } from './achievement-engine'
import { getCurrentTier, updateTier, addPoints as addTierPoints, getLoyaltyTiers, getLoyaltyConfig, updateLoyaltyConfig } from './tier-engine'
import { RewardCategory, TransactionType } from '@prisma/client'

export const LoyaltyEngine = {
  reward: {
    earnPoints,
    redeemPoints,
    getPointsBalance,
    getPointsHistory,
    adjustPoints,
  },
  cashback: {
    earnCashback,
    redeemCashback,
    getCashbackBalance,
    getCashbackHistory,
    getCashbackForOrder,
  },
  referral: {
    createReferral,
    completeReferral,
    claimReferralReward,
    getReferralStats,
    getReferralLeaderboard,
  },
  achievement: {
    checkAchievement,
    unlockAchievement,
    getUserAchievements,
  },
  tier: {
    getCurrentTier,
    updateTier,
    addPoints: addTierPoints,
    getLoyaltyTiers,
    getLoyaltyConfig,
    updateLoyaltyConfig,
  },
  processPurchaseReward,
  processServiceBookingReward,
  processReviewReward,
  processDailyLoginReward,
  processProfileCompleteReward,
  processFollowVendorReward,
  processWishlistActivityReward,
  processCollectionCreateReward,
  processRepeatPurchaseReward,
  processRepeatBookingReward,
}

export async function processPurchaseReward(
  userId: string,
  orderTotal: number,
  orderId: string
): Promise<void> {
  const prisma = getPrisma()

  const pointsEarned = Math.round(orderTotal * 10)
  const cashbackEarned = await getCashbackForOrder(orderTotal, userId)

  await Promise.all([
    earnPoints({
      userId,
      category: RewardCategory.PURCHASE,
      amount: pointsEarned,
      description: `Points earned from purchase order #${orderId.slice(0, 8)}`,
      referenceId: orderId,
      referenceType: 'ORDER',
    }),
    earnCashback({
      userId,
      source: 'PRODUCT_PURCHASE' as any,
      amount: cashbackEarned,
      description: `Cashback from purchase order #${orderId.slice(0, 8)}`,
      referenceId: orderId,
      referenceType: 'ORDER',
    }),
    addTierPoints(userId, pointsEarned, 'PURCHASE'),
  ])

  await checkAchievement({ userId, achievementSlug: 'first-purchase' })
  await checkAchievement({ userId, achievementSlug: 'frequent-shopper' })

  const loyalty = await prisma.customerLoyalty.findUnique({
    where: { userId },
  })

  if (loyalty) {
    await prisma.customerLoyalty.update({
      where: { userId },
      data: {
        lifetimeOrders: { increment: 1 },
        lastActivityAt: new Date(),
      },
    })
  }
}

export async function processServiceBookingReward(
  userId: string,
  servicePrice: number,
  serviceRequestId: string
): Promise<void> {
  const prisma = getPrisma()
  const pointsEarned = Math.round(servicePrice * 10)
  const cashbackEarned = await getCashbackForOrder(servicePrice, userId)

  await Promise.all([
    earnPoints({
      userId,
      category: RewardCategory.SERVICE_BOOKING,
      amount: pointsEarned,
      description: `Points earned from service booking #${serviceRequestId.slice(0, 8)}`,
      referenceId: serviceRequestId,
      referenceType: 'SERVICE_REQUEST',
    }),
    earnCashback({
      userId,
      source: 'PRODUCT_PURCHASE' as any,
      amount: cashbackEarned,
      description: `Cashback from service booking #${serviceRequestId.slice(0, 8)}`,
      referenceId: serviceRequestId,
      referenceType: 'SERVICE_REQUEST',
    }),
    addTierPoints(userId, pointsEarned, 'SERVICE_BOOKING'),
  ])

  await checkAchievement({ userId, achievementSlug: 'first-service-booking' })
  await checkAchievement({ userId, achievementSlug: 'frequent-client' })

  const loyalty = await prisma.customerLoyalty.findUnique({
    where: { userId },
  })

  if (loyalty) {
    await prisma.customerLoyalty.update({
      where: { userId },
      data: {
        lifetimeBookings: { increment: 1 },
        lastActivityAt: new Date(),
      },
    })
  }
}

export async function processReviewReward(
  userId: string,
  hasImages: boolean,
  hasVideos: boolean
): Promise<void> {
  const prisma = getPrisma()
  let points = 5
  const categories: RewardCategory[] = [RewardCategory.REVIEW]

  if (hasImages) {
    points += 2
    categories.push(RewardCategory.REVIEW_IMAGE)
  }

  if (hasVideos) {
    points += 3
    categories.push(RewardCategory.REVIEW_VIDEO)
  }

  await earnPoints({
    userId,
    category: categories[0],
    amount: points,
    description: `Points earned for writing a review${hasImages ? ' with images' : ''}${hasVideos ? ' with videos' : ''}`,
    referenceType: 'REVIEW',
  })

  await addTierPoints(userId, points, 'REVIEW')
  await checkAchievement({ userId, achievementSlug: 'first-review' })
  await checkAchievement({ userId, achievementSlug: 'top-reviewer' })

  const loyalty = await prisma.customerLoyalty.findUnique({
    where: { userId },
  })

  if (loyalty) {
    await prisma.customerLoyalty.update({
      where: { userId },
      data: {
        lifetimeReviews: { increment: 1 },
        lastActivityAt: new Date(),
      },
    })
  }
}

export async function processDailyLoginReward(userId: string): Promise<void> {
  const points = 2

  await earnPoints({
    userId,
    category: RewardCategory.DAILY_LOGIN,
    amount: points,
    description: 'Daily login reward',
  })

  await addTierPoints(userId, points, 'DAILY_LOGIN')
}

export async function processProfileCompleteReward(userId: string): Promise<void> {
  const points = 20

  await earnPoints({
    userId,
    category: RewardCategory.PROFILE_COMPLETE,
    amount: points,
    description: 'Profile completion reward',
  })

  await addTierPoints(userId, points, 'PROFILE_COMPLETE')
}

export async function processFollowVendorReward(userId: string): Promise<void> {
  const points = 5

  await earnPoints({
    userId,
    category: RewardCategory.FOLLOW_VENDOR,
    amount: points,
    description: 'Points for following a vendor',
  })

  await addTierPoints(userId, points, 'FOLLOW_VENDOR')
  await checkAchievement({ userId, achievementSlug: 'vendor-supporter' })
}

export async function processWishlistActivityReward(userId: string): Promise<void> {
  const points = 3

  await earnPoints({
    userId,
    category: RewardCategory.WISHLIST_ACTIVITY,
    amount: points,
    description: 'Points for wishlist activity',
  })

  await addTierPoints(userId, points, 'WISHLIST_ACTIVITY')
}

export async function processCollectionCreateReward(userId: string): Promise<void> {
  const points = 10

  await earnPoints({
    userId,
    category: RewardCategory.COLLECTION_CREATE,
    amount: points,
    description: 'Points for creating a collection',
  })

  await addTierPoints(userId, points, 'COLLECTION_CREATE')
}

export async function processRepeatPurchaseReward(
  userId: string,
  orderTotal: number,
  orderId: string
): Promise<void> {
  const pointsEarned = Math.round(orderTotal * 15)
  const cashbackEarned = await getCashbackForOrder(orderTotal, userId)

  await Promise.all([
    earnPoints({
      userId,
      category: RewardCategory.REPEAT_PURCHASE,
      amount: pointsEarned,
      description: `Repeat purchase bonus for order #${orderId.slice(0, 8)}`,
      referenceId: orderId,
      referenceType: 'ORDER',
    }),
    earnCashback({
      userId,
      source: 'PRODUCT_PURCHASE' as any,
      amount: cashbackEarned,
      description: `Repeat purchase cashback for order #${orderId.slice(0, 8)}`,
      referenceId: orderId,
      referenceType: 'ORDER',
    }),
    addTierPoints(userId, pointsEarned, 'REPEAT_PURCHASE'),
  ])
}

export async function processRepeatBookingReward(
  userId: string,
  servicePrice: number,
  serviceRequestId: string
): Promise<void> {
  const pointsEarned = Math.round(servicePrice * 15)
  const cashbackEarned = await getCashbackForOrder(servicePrice, userId)

  await Promise.all([
    earnPoints({
      userId,
      category: RewardCategory.REPEAT_BOOKING,
      amount: pointsEarned,
      description: `Repeat booking bonus for service request #${serviceRequestId.slice(0, 8)}`,
      referenceId: serviceRequestId,
      referenceType: 'SERVICE_REQUEST',
    }),
    earnCashback({
      userId,
      source: 'PRODUCT_PURCHASE' as any,
      amount: cashbackEarned,
      description: `Repeat booking cashback for service request #${serviceRequestId.slice(0, 8)}`,
      referenceId: serviceRequestId,
      referenceType: 'SERVICE_REQUEST',
    }),
    addTierPoints(userId, pointsEarned, 'REPEAT_BOOKING'),
  ])
}