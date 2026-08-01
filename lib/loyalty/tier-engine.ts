import { getPrisma } from '@/lib/prisma'
import { LoyaltyTier } from '@prisma/client'

interface TierUpdateResult {
  previousTier: LoyaltyTier | null
  newTier: LoyaltyTier
  upgraded: boolean
  downgraded: boolean
}

export async function getCurrentTier(userId: string): Promise<LoyaltyTier | null> {
  const prisma = getPrisma()
  const loyalty = await prisma.customerLoyalty.findUnique({
    where: { userId },
    include: { tier: true },
  })

  return loyalty?.tier ?? null
}

export async function updateTier(userId: string): Promise<TierUpdateResult> {
  const prisma = getPrisma()

  const loyalty = await prisma.customerLoyalty.findUnique({
    where: { userId },
    include: { tier: true },
  })

  if (!loyalty) {
    const defaultTier = await prisma.loyaltyTier.findFirst({
      where: { slug: 'bronze' },
    })

    if (!defaultTier) {
      throw new Error('Default loyalty tier not found')
    }

    const newLoyalty = await prisma.customerLoyalty.create({
      data: {
        userId,
        tierId: defaultTier.id,
        points: 0,
      },
      include: { tier: true },
    })

    return {
      previousTier: null,
      newTier: newLoyalty.tier,
      upgraded: false,
      downgraded: false,
    }
  }

  const currentTier = loyalty.tier
  const points = loyalty.points

  const eligibleTiers = await prisma.loyaltyTier.findMany({
    where: { isActive: true },
    orderBy: { minPoints: 'asc' },
  })

  let newTier = currentTier

  for (const tier of eligibleTiers) {
    if (points >= tier.minPoints) {
      if (tier.maxPoints === null || points <= tier.maxPoints) {
        newTier = tier
      }
    }
  }

  const upgraded = newTier.id !== currentTier.id && newTier.minPoints > currentTier.minPoints
  const downgraded = newTier.id !== currentTier.id && newTier.minPoints < currentTier.minPoints

  if (upgraded || downgraded) {
    await prisma.customerLoyalty.update({
      where: { userId },
      data: {
        tierId: newTier.id,
        tierUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }

  return {
    previousTier: currentTier,
    newTier,
    upgraded,
    downgraded,
  }
}

export async function addPoints(
  userId: string,
  points: number,
  source: string
): Promise<TierUpdateResult> {
  const prisma = getPrisma()

  const result = await prisma.$transaction(async (tx) => {
    const loyalty = await tx.customerLoyalty.upsert({
      where: { userId },
      update: {
        points: { increment: points },
        totalPointsEarned: { increment: points },
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId,
        tierId: (await prisma.loyaltyTier.findFirst({ where: { slug: 'bronze' } }))?.id ?? '',
        points,
        totalPointsEarned: points,
        lastActivityAt: new Date(),
      },
      include: { tier: true },
    })

    const tierResult = await updateTier(userId)

    return { loyalty, tierResult }
  })

  return result.tierResult
}

export async function getLoyaltyTiers(): Promise<LoyaltyTier[]> {
  const prisma = getPrisma()
  return prisma.loyaltyTier.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  })
}

export async function getLoyaltyConfig(): Promise<Record<string, any>> {
  const prisma = getPrisma()
  const configs = await prisma.loyaltyConfig.findMany()

  const result: Record<string, any> = {}
  for (const config of configs) {
    result[config.key] = config.value
  }

  return result
}

export async function updateLoyaltyConfig(
  key: string,
  value: any,
  description?: string
): Promise<any> {
  const prisma = getPrisma()
  return prisma.loyaltyConfig.upsert({
    where: { key },
    update: {
      value,
      description,
      updatedAt: new Date(),
    },
    create: {
      key,
      value,
      description,
    },
  })
}