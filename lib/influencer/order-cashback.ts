import { getPrisma } from '@/lib/prisma'
import { CashbackSource } from '@prisma/client'
import { createNotification } from '@/lib/notifications'

export async function creditInfluencerOrderCashback(
  userId: string,
  orderId: string,
  influencerCode: string,
  subtotal: number
): Promise<void> {
  const prisma = getPrisma()

  const existing = await prisma.influencerCashback.findUnique({
    where: { orderId },
  })
  if (existing) {
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { influencerCashbackOrdersUsed: true },
  })
  if (!user) {
    return
  }

  const influencer = await prisma.influencer.findUnique({
    where: { referralCode: influencerCode },
    select: { customerCashbackPercent: true, customerCashbackMaxOrders: true, active: true },
  })

  if (!influencer || !influencer.active) {
    return
  }

  if (user.influencerCashbackOrdersUsed >= influencer.customerCashbackMaxOrders) {
    return
  }

  const cashbackAmount = Math.round(subtotal * (influencer.customerCashbackPercent / 100) * 100) / 100
  if (cashbackAmount <= 0) {
    return
  }

  await prisma.$transaction(async (tx) => {
    const cashback = await tx.cashbackBalance.upsert({
      where: { userId },
      update: {
        balance: { increment: cashbackAmount },
        totalEarned: { increment: cashbackAmount },
        updatedAt: new Date(),
      },
      create: {
        userId,
        balance: cashbackAmount,
        totalEarned: cashbackAmount,
      },
    })

    await tx.cashbackTransaction.create({
      data: {
        userId,
        amount: cashbackAmount,
        source: CashbackSource.INFLUENCER,
        description: `Influencer cashback: order #${orderId.slice(0, 8)}`,
        referenceId: orderId,
        referenceType: 'ORDER',
        metadata: { influencerCode, orderSubtotal: subtotal } as any,
      },
    })

    await tx.influencerCashback.create({
      data: {
        userId,
        orderId,
        cashbackAmount,
        source: 'INFLUENCER',
      },
    })

    await tx.user.update({
      where: { id: userId },
      data: { influencerCashbackOrdersUsed: { increment: 1 } },
    })

    return { balanceAfter: cashback.balance }
  })

  createNotification(
    userId,
    'CASHBACK_EARNED',
    'Influencer Cashback',
    `You've earned GH\u20B5${cashbackAmount.toFixed(2)} cashback from your order!`
  ).catch(() => {})
}

export async function reverseInfluencerOrderCashback(orderId: string): Promise<void> {
  const prisma = getPrisma()

  const cashbackRecord = await prisma.influencerCashback.findUnique({
    where: { orderId },
  })
  if (!cashbackRecord) {
    return
  }

  const amount = cashbackRecord.cashbackAmount
  if (amount <= 0) {
    return
  }

  // The user was deleted (InfluencerCashback.userId is set to NULL on user
  // delete): the record is orphaned and there is no balance left to reverse.
  // Delete it instead of throwing, so order cancellation and refunds cannot
  // fail on it.
  if (!cashbackRecord.userId) {
    await prisma.influencerCashback.delete({ where: { orderId } })
    return
  }

  const userId = cashbackRecord.userId

  await prisma.$transaction(async (tx) => {
    const cashback = await tx.cashbackBalance.findUnique({
      where: { userId },
    })

    if (cashback) {
      const newBalance = Math.round((cashback.balance - amount) * 100) / 100
      await tx.cashbackBalance.update({
        where: { userId },
        data: {
          balance: newBalance,
          totalRedeemed: { increment: amount },
        },
      })

      await tx.cashbackTransaction.create({
        data: {
          userId,
          amount: -amount,
          source: 'ADJUSTMENT',
          description: `Reversed influencer cashback for order #${orderId.slice(0, 8)}`,
          referenceId: orderId,
          referenceType: 'ORDER',
          metadata: { reason: 'ORDER_CANCELLED_OR_REFUNDED' } as any,
        },
      })
    }

    await tx.user.update({
      where: { id: userId },
      data: { influencerCashbackOrdersUsed: { decrement: 1 } },
    })

    await tx.influencerCashback.delete({
      where: { orderId },
    })
  })
}
