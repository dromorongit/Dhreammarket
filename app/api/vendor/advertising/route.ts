import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import {
  getCampaignsByVendor,
  getCampaignById,
  updateCampaignStatus,
  getCampaignAnalytics,
} from '@/lib/advertising/service'
import { getSubscriptionPlanFeatures, getVendorCampaignLimit } from '@/lib/advertising/subscription-integration'
import { logInfo, logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'active'

    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      pending: 'PENDING_APPROVAL',
      'pending-payment': 'PENDING_PAYMENT',
      rejected: 'REJECTED',
      expired: 'EXPIRED',
      all: '',
    }

    const status = statusMap[tab] as any
    const [allCampaigns, features, limitInfo] = await Promise.all([
      getCampaignsByVendor(payload.userId),
      getSubscriptionPlanFeatures(payload.userId),
      getVendorCampaignLimit(payload.userId),
    ])

    const campaigns = status
      ? allCampaigns.filter((c) => c.campaignStatus === status)
      : allCampaigns

    const analytics = await Promise.all(
      allCampaigns
        .filter((c) => c.campaignStatus === 'ACTIVE')
        .slice(0, 5)
        .map((c) => getCampaignAnalytics(c.id))
    )

    return NextResponse.json({
      campaigns,
      allCampaigns,
      features,
      analytics: analytics.filter(Boolean),
      totalCampaigns: allCampaigns.length,
      consumedSlots: limitInfo.currentCampaigns,
      maxSlots: limitInfo.maxCampaigns,
      tabs: {
        active: allCampaigns.filter((c) => c.campaignStatus === 'ACTIVE').length,
        pending: allCampaigns.filter((c) => c.campaignStatus === 'PENDING_APPROVAL').length,
        rejected: allCampaigns.filter((c) => c.campaignStatus === 'REJECTED').length,
        expired: allCampaigns.filter((c) => c.campaignStatus === 'EXPIRED').length,
      },
    })
  } catch (error) {
    logError(`Error fetching vendor advertising dashboard: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}