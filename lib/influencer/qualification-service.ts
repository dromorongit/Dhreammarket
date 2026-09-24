import { getPrisma } from '@/lib/prisma'

export async function checkAndQualifyInfluencerReferral(userId: string): Promise<void> {
  const prisma = getPrisma()

  const unqualifiedReferral = await prisma.influencerReferral.findFirst({
    where: {
      refereeId: userId,
      qualified: false,
    },
    include: {
      influencer: true,
    },
  })

  if (!unqualifiedReferral) {
    return
  }

  let isQualified = false

  if (unqualifiedReferral.refereeRole === 'VENDOR') {
    const store = await prisma.store.findUnique({
      where: { userId },
      select: { id: true },
    })

    if (store) {
      const productCount = await prisma.product.count({
        where: { storeId: store.id },
      })
      isQualified = productCount >= 20
    }
  } else if (unqualifiedReferral.refereeRole === 'CUSTOMER') {
    const paidOrderCount = await prisma.order.count({
      where: {
        userId,
        paymentStatus: 'PAID',
      },
    })
    isQualified = paidOrderCount >= 1
  }

  if (!isQualified) {
    return
  }

  const incentiveAmount =
    unqualifiedReferral.refereeRole === 'VENDOR'
      ? unqualifiedReferral.influencer.incentivePerVendor
      : unqualifiedReferral.influencer.incentivePerCustomer

  await prisma.influencerReferral.update({
    where: { id: unqualifiedReferral.id },
    data: {
      qualified: true,
      qualifiedAt: new Date(),
      incentiveAmount: incentiveAmount ?? undefined,
    },
  })
}
