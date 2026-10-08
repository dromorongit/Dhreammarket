import { getPrisma } from '@/lib/prisma'
import { RewardCategory, TransactionType } from '@prisma/client'
import { createNotification } from '@/lib/notifications'

export async function creditInfluencerSignupBonus(userId: string, influencerCode: string): Promise<void> {
  const prisma = getPrisma()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { influencerBonusGrantedAt: true },
  })

  if (!user || user.influencerBonusGrantedAt) {
    return
  }

  const influencer = await prisma.influencer.findUnique({
    where: { referralCode: influencerCode },
    select: { customerSignupPoints: true, active: true },
  })

  if (!influencer || !influencer.active) {
    return
  }

  const points = influencer.customerSignupPoints
  if (points <= 0) {
    return
  }

  await prisma.$transaction(async (tx) => {
    const rewardPoints = await tx.rewardPoints.upsert({
      where: { userId },
      update: {
        balance: { increment: points },
        totalEarned: { increment: points },
        updatedAt: new Date(),
      },
      create: {
        userId,
        balance: points,
        totalEarned: points,
      },
    })

    await tx.rewardTransaction.create({
      data: {
        userId,
        type: TransactionType.BONUS,
        category: RewardCategory.SPECIAL_OFFER,
        amount: points,
        balanceAfter: rewardPoints.balance,
        description: 'Influencer signup bonus',
        referenceId: userId,
        referenceType: 'USER',
        metadata: { influencerCode } as any,
      },
    })

    await tx.user.update({
      where: { id: userId },
      data: { influencerBonusGrantedAt: new Date() },
    })
  })

  createNotification(
    userId,
    'POINTS_EARNED',
    'Welcome Bonus',
    `${points} reward points have been added to your account via influencer referral.`
  ).catch(() => {})
}
