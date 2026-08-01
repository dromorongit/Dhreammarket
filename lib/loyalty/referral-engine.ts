import { getPrisma } from '@/lib/prisma'
import { ReferralStatus } from '@prisma/client'
import { randomUUID } from 'crypto'

interface CreateReferralInput {
  referrerId: string
  source?: string
}

interface CompleteReferralInput {
  referralCode: string
  refereeId: string
}

interface ReferralRewardInput {
  referralCode: string
  rewardPoints: number
  rewardCashback: number
}

interface ReferralStats {
  userId: string
  totalReferrals: number
  successfulReferrals: number
  pendingReferrals: number
  totalRewardPoints: number
  totalRewardCashback: number
}

export async function createReferral(input: CreateReferralInput): Promise<any> {
  const prisma = getPrisma()
  const { referrerId, source } = input

  const code = `REF-${randomUUID().slice(0, 8).toUpperCase()}`

  const referral = await prisma.referralRecord.create({
    data: {
      referrerId,
      code,
      source,
      status: ReferralStatus.PENDING,
    },
  })

  return referral
}

export async function getReferralByCode(code: string): Promise<any> {
  const prisma = getPrisma()
  return prisma.referralRecord.findUnique({
    where: { code },
    include: { referrer: { select: { id: true, email: true, profile: true } } },
  })
}

export async function completeReferral(input: CompleteReferralInput): Promise<any> {
  const prisma = getPrisma()
  const { referralCode, refereeId } = input

  const result = await prisma.$transaction(async (tx) => {
    const referral = await tx.referralRecord.update({
      where: { code: referralCode },
      data: {
        refereeId,
        status: ReferralStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: { referrer: true },
    })

    if (referral.referrerId !== refereeId) {
      await tx.customerLoyalty.update({
        where: { userId: referral.referrerId },
        data: {
          lifetimeReferrals: { increment: 1 },
          successfulReferrals: { increment: 1 },
        },
      })
    }

    return referral
  })

  return result
}

export async function claimReferralReward(input: ReferralRewardInput): Promise<any> {
  const prisma = getPrisma()
  const { referralCode, rewardPoints, rewardCashback } = input

  const result = await prisma.$transaction(async (tx) => {
    const referral = await tx.referralRecord.update({
      where: { code: referralCode },
      data: {
        status: ReferralStatus.REWARD_CLAIMED,
        rewardPoints,
        rewardCashback,
      },
    })

    if (rewardPoints > 0) {
      await tx.rewardPoints.upsert({
        where: { userId: referral.referrerId },
        update: {
          balance: { increment: rewardPoints },
          totalEarned: { increment: rewardPoints },
          updatedAt: new Date(),
        },
        create: {
          userId: referral.referrerId,
          balance: rewardPoints,
          totalEarned: rewardPoints,
        },
      })

      await tx.rewardTransaction.create({
        data: {
          userId: referral.referrerId,
          type: 'EARN' as any,
          category: 'REFERRAL' as any,
          amount: rewardPoints,
          balanceAfter: 0,
          description: `Referral reward for code ${referralCode}`,
          referenceId: referral.id,
          referenceType: 'REFERRAL',
        },
      })
    }

    if (rewardCashback > 0) {
      await tx.cashbackBalance.upsert({
        where: { userId: referral.referrerId },
        update: {
          balance: { increment: rewardCashback },
          totalEarned: { increment: rewardCashback },
          updatedAt: new Date(),
        },
        create: {
          userId: referral.referrerId,
          balance: rewardCashback,
          totalEarned: rewardCashback,
        },
      })

      await tx.cashbackTransaction.create({
        data: {
          userId: referral.referrerId,
          amount: rewardCashback,
          source: 'REFERRAL_BONUS' as any,
          description: `Referral cashback reward for code ${referralCode}`,
          referenceId: referral.id,
          referenceType: 'REFERRAL',
        },
      })
    }

    return referral
  })

  return result
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const prisma = getPrisma()
  const referrals = await prisma.referralRecord.findMany({
    where: { referrerId: userId },
  })

  const totalReferrals = referrals.length
  const successfulReferrals = referrals.filter((r) => r.status === ReferralStatus.COMPLETED || r.status === ReferralStatus.REWARD_CLAIMED).length
  const pendingReferrals = referrals.filter((r) => r.status === ReferralStatus.PENDING).length
  const totalRewardPoints = referrals.reduce((sum, r) => sum + (r.rewardPoints ?? 0), 0)
  const totalRewardCashback = referrals.reduce((sum, r) => sum + (r.rewardCashback ?? 0), 0)

  return {
    userId,
    totalReferrals,
    successfulReferrals,
    pendingReferrals,
    totalRewardPoints,
    totalRewardCashback,
  }
}

export async function getReferralLeaderboard(limit: number = 10): Promise<any[]> {
  const prisma = getPrisma()
  return prisma.customerLoyalty.findMany({
    where: { successfulReferrals: { gt: 0 } },
    select: {
      userId: true,
      user: { select: { id: true, profile: true, email: true } },
      successfulReferrals: true,
    },
    orderBy: { successfulReferrals: 'desc' },
    take: limit,
  })
}