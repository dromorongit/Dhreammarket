import { getPrisma } from '@/lib/prisma'
import { LoyaltyEngine } from '@/lib/loyalty/loyalty-engine'

interface VendorCampaignResult {
  campaignId: string
  name: string
  rewardAmount: number
  rewardType: string
}

export async function getVendorRewardCampaigns(vendorId: string): Promise<any[]> {
  const prisma = getPrisma()
  return prisma.vendorRewardCampaign.findMany({
    where: {
      vendorId,
      isActive: true,
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function processVendorCampaignReward(
  userId: string,
  vendorId: string,
  orderTotal: number,
  orderId: string
): Promise<VendorCampaignResult[]> {
  const prisma = getPrisma()
  const campaigns = await getVendorRewardCampaigns(vendorId)
  const results: VendorCampaignResult[] = []

  for (const campaign of campaigns) {
    if (campaign.minPurchase && orderTotal < campaign.minPurchase) continue

    let rewardAmount = campaign.value
    if (campaign.maxReward && rewardAmount > campaign.maxReward) {
      rewardAmount = campaign.maxReward
    }

    if (campaign.rewardType === 'POINTS') {
      await LoyaltyEngine.reward.earnPoints({
        userId,
        category: 'PURCHASE' as any,
        amount: rewardAmount,
        description: `Vendor campaign: ${campaign.name}`,
        referenceId: orderId,
        referenceType: 'ORDER',
        metadata: { campaignId: campaign.id },
      })
    } else if (campaign.rewardType === 'CASHBACK') {
      await LoyaltyEngine.cashback.earnCashback({
        userId,
        source: 'VENDOR_CAMPAIGN' as any,
        amount: rewardAmount,
        description: `Vendor campaign: ${campaign.name}`,
        referenceId: orderId,
        referenceType: 'ORDER',
        metadata: { campaignId: campaign.id },
      })
    }

    results.push({
      campaignId: campaign.id,
      name: campaign.name,
      rewardAmount,
      rewardType: campaign.rewardType,
    })
  }

  return results
}

export async function getVendorLoyaltyCampaigns(vendorId: string): Promise<any[]> {
  const prisma = getPrisma()
  return prisma.vendorRewardCampaign.findMany({
    where: {
      vendorId,
      isActive: true,
      type: 'POINTS_MULTIPLIER',
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getVendorExclusiveCoupons(vendorId: string): Promise<any[]> {
  const prisma = getPrisma()
  const campaigns = await prisma.vendorRewardCampaign.findMany({
    where: {
      vendorId,
      isActive: true,
      rewardType: 'COUPON',
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    value: c.value,
    type: c.rewardType,
    minPurchase: c.minPurchase,
    maxReward: c.maxReward,
  }))
}