import { getPrisma } from '@/lib/prisma'
import { CashbackSource } from '@prisma/client'

interface EarnCashbackInput {
  userId: string
  source: CashbackSource
  amount: number
  description?: string
  referenceId?: string
  referenceType?: string
  metadata?: Record<string, any>
}

interface RedeemCashbackInput {
  userId: string
  amount: number
  description?: string
  referenceId?: string
  referenceType?: string
}

interface CashbackBalanceResult {
  userId: string
  balance: number
  totalEarned: number
  totalRedeemed: number
}

export async function earnCashback(input: EarnCashbackInput): Promise<any> {
  const prisma = getPrisma()
  const { userId, source, amount, description, referenceId, referenceType, metadata } = input

  const result = await prisma.$transaction(async (tx) => {
    let cashback = await tx.cashbackBalance.upsert({
      where: { userId },
      update: {
        balance: { increment: amount },
        totalEarned: { increment: amount },
        updatedAt: new Date(),
      },
      create: {
        userId,
        balance: amount,
        totalEarned: amount,
      },
    })

    const transaction = await tx.cashbackTransaction.create({
      data: {
        userId,
        amount,
        source,
        description,
        referenceId,
        referenceType,
        metadata: (metadata ?? null) as any,
      },
    })

    return { cashback, transaction }
  })

  return result
}

export async function redeemCashback(input: RedeemCashbackInput): Promise<any> {
  const prisma = getPrisma()
  const { userId, amount, description, referenceId, referenceType } = input

  const result = await prisma.$transaction(async (tx) => {
    const cashback = await tx.cashbackBalance.findUnique({
      where: { userId },
    })

    if (!cashback) {
      throw new Error('Cashback account not found')
    }

    if (cashback.balance < amount) {
      throw new Error('Insufficient cashback balance')
    }

    const updated = await tx.cashbackBalance.update({
      where: { userId },
      data: {
        balance: { decrement: amount },
        totalRedeemed: { increment: amount },
        updatedAt: new Date(),
      },
    })

    const transaction = await tx.cashbackTransaction.create({
      data: {
        userId,
        amount: -amount,
        source: CashbackSource.REWARD_REDEMPTION,
        description,
        referenceId,
        referenceType,
      },
    })

    return { cashback: updated, transaction }
  })

  return result
}

export async function getCashbackBalance(userId: string): Promise<CashbackBalanceResult> {
  const prisma = getPrisma()
  const balance = await prisma.cashbackBalance.findUnique({
    where: { userId },
  })

  return {
    userId,
    balance: balance?.balance ?? 0,
    totalEarned: balance?.totalEarned ?? 0,
    totalRedeemed: balance?.totalRedeemed ?? 0,
  }
}

export async function getCashbackHistory(userId: string, page: number = 1, pageSize: number = 20) {
  const prisma = getPrisma()
  const skip = (page - 1) * pageSize

  const [transactions, total] = await Promise.all([
    prisma.cashbackTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.cashbackTransaction.count({
      where: { userId },
    }),
  ])

  return {
    transactions,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

export async function getCashbackForOrder(
  orderTotal: number,
  userId: string,
  vendorId?: string,
  productIds?: string[],
  serviceIds?: string[]
): Promise<number> {
  const prisma = getPrisma()

  const userLoyalty = await prisma.customerLoyalty.findUnique({
    where: { userId },
    include: { tier: true },
  })

  const baseRate = userLoyalty?.tier?.cashbackRate ?? 0
  const multiplier = userLoyalty?.tier?.multiplier ?? 1.0

  let cashbackAmount = orderTotal * baseRate * multiplier

  if (vendorId) {
    const activeCampaigns = await prisma.vendorRewardCampaign.findMany({
      where: {
        vendorId,
        isActive: true,
        rewardType: 'CASHBACK',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    })

    for (const campaign of activeCampaigns) {
      if (campaign.minPurchase && orderTotal < campaign.minPurchase) continue
      const maxReward = campaign.maxReward ?? Infinity
      cashbackAmount = Math.min(cashbackAmount + campaign.value, maxReward)
    }
  }

  return Math.round(cashbackAmount * 100) / 100
}