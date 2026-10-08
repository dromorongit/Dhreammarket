import { getPrisma } from '@/lib/prisma'

export interface InfluencerPerksConfig {
  customerSignupPoints: number
  customerCashbackPercent: number
  customerCashbackMaxOrders: number
  vendorPlan: string
  vendorPlanDurationMonths: number
}

export async function getInfluencerPerksConfig(influencerCode: string): Promise<InfluencerPerksConfig | null> {
  const prisma = getPrisma()
  const influencer = await prisma.influencer.findUnique({
    where: { referralCode: influencerCode },
    select: {
      active: true,
      customerSignupPoints: true,
      customerCashbackPercent: true,
      customerCashbackMaxOrders: true,
      vendorPlan: true,
      vendorPlanDurationMonths: true,
    },
  })

  if (!influencer || !influencer.active) {
    return null
  }

  return {
    customerSignupPoints: influencer.customerSignupPoints,
    customerCashbackPercent: influencer.customerCashbackPercent,
    customerCashbackMaxOrders: influencer.customerCashbackMaxOrders,
    vendorPlan: influencer.vendorPlan,
    vendorPlanDurationMonths: influencer.vendorPlanDurationMonths,
  }
}
