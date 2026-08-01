import { getPrisma } from '@/lib/prisma'
import { Achievement } from '@prisma/client'

interface CheckAchievementInput {
  userId: string
  achievementSlug: string
}

interface UnlockAchievementInput {
  userId: string
  achievementSlug: string
}

interface AchievementProgress {
  achievement: Achievement
  unlocked: boolean
  unlockedAt?: string | null
  progress: number
  maxProgress: number
}

export async function checkAchievement(input: CheckAchievementInput): Promise<boolean> {
  const prisma = getPrisma()
  const { userId, achievementSlug } = input

  const existing = await prisma.customerAchievement.findFirst({
    where: {
      userId,
      achievement: { slug: achievementSlug },
    },
  })

  if (existing) return true

  const achievement = await prisma.achievement.findUnique({
    where: { slug: achievementSlug },
  })

  if (!achievement || !achievement.isActive) return false

  const criteria = achievement.criteria as Record<string, any>
  let unlocked = false

  switch (achievement.slug) {
    case 'first-purchase': {
      const orders = await prisma.order.count({
        where: { userId, status: { in: ['COMPLETED', 'DELIVERED'] } },
      })
      unlocked = orders >= 1
      break
    }
    case 'first-service-booking': {
      const bookings = await prisma.serviceRequest.count({
        where: { customerId: userId, status: { in: ['COMPLETED', 'ACCEPTED'] } },
      })
      unlocked = bookings >= 1
      break
    }
    case 'first-review': {
      const reviews = await prisma.productReview.count({
        where: { userId },
      })
      unlocked = reviews >= 1
      break
    }
    case 'top-reviewer': {
      const reviews = await prisma.productReview.count({
        where: { userId },
      })
      unlocked = reviews >= 10
      break
    }
    case 'frequent-shopper': {
      const orders = await prisma.order.count({
        where: { userId, status: { in: ['COMPLETED', 'DELIVERED'] } },
      })
      unlocked = orders >= 5
      break
    }
    case 'frequent-client': {
      const bookings = await prisma.serviceRequest.count({
        where: { customerId: userId, status: { in: ['COMPLETED', 'ACCEPTED'] } },
      })
      unlocked = bookings >= 5
      break
    }
    case 'marketplace-explorer': {
      const recentlyViewed = await prisma.recentlyViewed.count({
        where: { userId },
      })
      unlocked = recentlyViewed >= 20
      break
    }
    case 'vendor-supporter': {
      const follows = await prisma.vendorFollow.count({
        where: { userId },
      })
      unlocked = follows >= 3
      break
    }
    case 'referral-champion': {
      const loyalty = await prisma.customerLoyalty.findUnique({
        where: { userId },
        select: { successfulReferrals: true },
      })
      unlocked = (loyalty?.successfulReferrals ?? 0) >= 5
      break
    }
    case 'early-adopter': {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
      })
      if (user?.createdAt) {
        const daysSinceCreation = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        unlocked = daysSinceCreation <= 30
      }
      break
    }
    default:
      unlocked = false
  }

  if (unlocked) {
    await prisma.customerAchievement.create({
      data: {
        userId,
        achievementId: achievement.id,
      },
    })
  }

  return unlocked
}

export async function unlockAchievement(input: UnlockAchievementInput): Promise<any> {
  const prisma = getPrisma()
  const { userId, achievementSlug } = input

  const achievement = await prisma.achievement.findUnique({
    where: { slug: achievementSlug },
  })

  if (!achievement) {
    throw new Error('Achievement not found')
  }

  const existing = await prisma.customerAchievement.findFirst({
    where: {
      userId,
      achievementId: achievement.id,
    },
  })

  if (existing) {
    return { alreadyUnlocked: true, achievement }
  }

  const result = await prisma.customerAchievement.create({
    data: {
      userId,
      achievementId: achievement.id,
    },
    include: { achievement: true },
  })

  return { alreadyUnlocked: false, achievement: result.achievement }
}

export async function getUserAchievements(userId: string): Promise<AchievementProgress[]> {
  const prisma = getPrisma()
  const achievements = await prisma.achievement.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  })

  const unlockedIds = await prisma.customerAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  })

  const unlockedSet = new Set(unlockedIds.map((ua) => ua.achievementId))

  const userLoyalty = await prisma.customerLoyalty.findUnique({
    where: { userId },
    select: {
      lifetimeOrders: true,
      lifetimeBookings: true,
      lifetimeReviews: true,
      successfulReferrals: true,
    },
  })

  const results: AchievementProgress[] = []

  for (const achievement of achievements) {
    const criteria = achievement.criteria as Record<string, any>
    let progress = 0
    let maxProgress = 1

    switch (achievement.slug) {
      case 'first-purchase':
        progress = Math.min((userLoyalty?.lifetimeOrders ?? 0), 1)
        maxProgress = 1
        break
      case 'first-service-booking':
        progress = Math.min((userLoyalty?.lifetimeBookings ?? 0), 1)
        maxProgress = 1
        break
      case 'first-review':
        progress = Math.min((userLoyalty?.lifetimeReviews ?? 0), 1)
        maxProgress = 1
        break
      case 'top-reviewer':
        progress = Math.min((userLoyalty?.lifetimeReviews ?? 0), 10)
        maxProgress = 10
        break
      case 'frequent-shopper':
        progress = Math.min((userLoyalty?.lifetimeOrders ?? 0), 5)
        maxProgress = 5
        break
      case 'frequent-client':
        progress = Math.min((userLoyalty?.lifetimeBookings ?? 0), 5)
        maxProgress = 5
        break
      case 'marketplace-explorer': {
        const viewed = await prisma.recentlyViewed.count({ where: { userId } })
        progress = Math.min(viewed, 20)
        maxProgress = 20
        break
      }
      case 'vendor-supporter': {
        const follows = await prisma.vendorFollow.count({ where: { userId } })
        progress = Math.min(follows, 3)
        maxProgress = 3
        break
      }
      case 'referral-champion':
        progress = Math.min((userLoyalty?.successfulReferrals ?? 0), 5)
        maxProgress = 5
        break
      case 'early-adopter': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { createdAt: true },
        })
        if (user?.createdAt) {
          const daysSinceCreation = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          progress = Math.max(0, 30 - Math.floor(daysSinceCreation))
          maxProgress = 30
        }
        break
      }
      default:
        progress = 0
        maxProgress = 1
    }

    results.push({
      achievement,
      unlocked: unlockedSet.has(achievement.id),
      unlockedAt: unlockedSet.has(achievement.id)
        ? (await prisma.customerAchievement.findFirst({
            where: { userId, achievementId: achievement.id },
            select: { unlockedAt: true },
          }))?.unlockedAt?.toISOString() ?? null
        : null,
      progress,
      maxProgress,
    })
  }

  return results
}