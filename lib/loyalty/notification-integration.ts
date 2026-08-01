import { getPrisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'
import { createNotification } from '@/lib/notifications'

export async function notifyPointsEarned(userId: string, amount: number, description: string): Promise<void> {
  await createNotification(
    userId,
    'POINTS_EARNED',
    'Points Earned',
    description ?? `You earned ${amount} points!`
  )
}

export async function notifyPointsRedeemed(userId: string, amount: number, description: string): Promise<void> {
  await createNotification(
    userId,
    'POINTS_REDEEMED',
    'Points Redeemed',
    description ?? `You redeemed ${amount} points.`
  )
}

export async function notifyCashbackEarned(userId: string, amount: number, description: string): Promise<void> {
  await createNotification(
    userId,
    'CASHBACK_EARNED',
    'Cashback Earned',
    description ?? `You earned GHS ${amount.toFixed(2)} in cashback!`
  )
}

export async function notifyCashbackRedeemed(userId: string, amount: number, description: string): Promise<void> {
  await createNotification(
    userId,
    'CASHBACK_REDEEMED',
    'Cashback Redeemed',
    description ?? `You redeemed GHS ${amount.toFixed(2)} in cashback.`
  )
}

export async function notifyTierUpgraded(userId: string, newTier: string, previousTier: string | null): Promise<void> {
  await createNotification(
    userId,
    'TIER_UPGRADED',
    'Tier Upgraded',
    `Congratulations! You have been upgraded from ${previousTier ?? 'Bronze'} to ${newTier} tier!`
  )
}

export async function notifyTierDowngraded(userId: string, newTier: string, previousTier: string): Promise<void> {
  await createNotification(
    userId,
    'TIER_DOWNGRADED',
    'Tier Changed',
    `Your loyalty tier has changed from ${previousTier} to ${newTier}.`
  )
}

export async function notifyBadgeUnlocked(userId: string, badgeName: string): Promise<void> {
  await createNotification(
    userId,
    'BADGE_UNLOCKED',
    'Badge Unlocked',
    `Congratulations! You unlocked the "${badgeName}" badge!`
  )
}

export async function notifyRewardRedeemed(userId: string, description: string): Promise<void> {
  await createNotification(
    userId,
    'REWARD_REDEEMED',
    'Reward Redeemed',
    description ?? 'You have redeemed a reward.'
  )
}

export async function notifyReferralCompleted(userId: string, referralCode: string): Promise<void> {
  await createNotification(
    userId,
    'REFERRAL_COMPLETED',
    'Referral Completed',
    `Your referral code ${referralCode} has been completed!`
  )
}

export async function notifyReferralRewardClaimed(userId: string, points: number, cashback: number): Promise<void> {
  await createNotification(
    userId,
    'REFERRAL_REWARD_CLAIMED',
    'Referral Reward Claimed',
    `You claimed your referral reward: ${points} points and GHS ${cashback.toFixed(2)} cashback.`
  )
}

export async function notifyVendorRewardCampaign(userId: string, campaignName: string): Promise<void> {
  await createNotification(
    userId,
    'VENDOR_REWARD_CAMPAIGN',
    'Vendor Reward Campaign',
    `A new vendor reward campaign "${campaignName}" is now available!`
  )
}

export async function notifyLoyaltyOffer(userId: string, offerTitle: string): Promise<void> {
  await createNotification(
    userId,
    'LOYALTY_OFFER',
    'Loyalty Offer',
    `New offer available: ${offerTitle}`
  )
}