import { getPrisma } from '@/lib/prisma'
import { RewardCategory, TransactionType } from '@prisma/client'

interface EarnPointsInput {
  userId: string
  category: RewardCategory
  amount: number
  description?: string
  referenceId?: string
  referenceType?: string
  metadata?: Record<string, any>
}

interface RedeemPointsInput {
  userId: string
  amount: number
  description?: string
  referenceId?: string
  referenceType?: string
}

interface PointsBalance {
  userId: string
  balance: number
  totalEarned: number
  totalRedeemed: number
}

export async function earnPoints(input: EarnPointsInput): Promise<any> {
  const prisma = getPrisma()
  const { userId, category, amount, description, referenceId, referenceType, metadata } = input

  const result = await prisma.$transaction(async (tx) => {
    let rewardPoints = await tx.rewardPoints.upsert({
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

    const transaction = await tx.rewardTransaction.create({
      data: {
        userId,
        type: TransactionType.EARN,
        category,
        amount,
        balanceAfter: rewardPoints.balance,
        description,
        referenceId,
        referenceType,
        metadata: (metadata ?? null) as any,
      },
    })

    return { rewardPoints, transaction }
  })

  return result
}

export async function redeemPoints(input: RedeemPointsInput): Promise<any> {
  const prisma = getPrisma()
  const { userId, amount, description, referenceId, referenceType } = input

  const result = await prisma.$transaction(async (tx) => {
    const rewardPoints = await tx.rewardPoints.findUnique({
      where: { userId },
    })

    if (!rewardPoints) {
      throw new Error('Reward points account not found')
    }

    if (rewardPoints.balance < amount) {
      throw new Error('Insufficient points balance')
    }

    const updated = await tx.rewardPoints.update({
      where: { userId },
      data: {
        balance: { decrement: amount },
        totalRedeemed: { increment: amount },
        updatedAt: new Date(),
      },
    })

    const transaction = await tx.rewardTransaction.create({
      data: {
        userId,
        type: TransactionType.REDEEM,
        category: RewardCategory.COUPON_REDEEM,
        amount: -amount,
        balanceAfter: updated.balance,
        description,
        referenceId,
        referenceType,
      },
    })

    return { rewardPoints: updated, transaction }
  })

  return result
}

export async function getPointsBalance(userId: string): Promise<PointsBalance> {
  const prisma = getPrisma()
  const balance = await prisma.rewardPoints.findUnique({
    where: { userId },
  })

  return {
    userId,
    balance: balance?.balance ?? 0,
    totalEarned: balance?.totalEarned ?? 0,
    totalRedeemed: balance?.totalRedeemed ?? 0,
  }
}

export async function getPointsHistory(userId: string, page: number = 1, pageSize: number = 20) {
  const prisma = getPrisma()
  const skip = (page - 1) * pageSize

  const [transactions, total] = await Promise.all([
    prisma.rewardTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.rewardTransaction.count({
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

export async function adjustPoints(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string,
  referenceType?: string
): Promise<any> {
  const prisma = getPrisma()

  const result = await prisma.$transaction(async (tx) => {
    const rewardPoints = await tx.rewardPoints.upsert({
      where: { userId },
      update: {
        balance: { increment: amount },
        totalEarned: amount > 0 ? { increment: amount } : undefined,
        totalRedeemed: amount < 0 ? { increment: Math.abs(amount) } : undefined,
        updatedAt: new Date(),
      },
      create: {
        userId,
        balance: amount,
        totalEarned: amount > 0 ? amount : 0,
        totalRedeemed: amount < 0 ? Math.abs(amount) : 0,
      },
    })

    const transaction = await tx.rewardTransaction.create({
      data: {
        userId,
        type: TransactionType.ADJUST,
        category: RewardCategory.PURCHASE,
        amount,
        balanceAfter: rewardPoints.balance,
        description,
        referenceId,
        referenceType,
      },
    })

    return { rewardPoints, transaction }
  })

  return result
}