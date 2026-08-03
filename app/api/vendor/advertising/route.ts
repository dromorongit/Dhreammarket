import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import {
  getCampaignsByVendor,
  getCampaignById,
  updateCampaignStatus,
  getCampaignAnalytics,
} from '@/lib/advertising/service'
import { getSubscriptionPlanFeatures } from '@/lib/advertising/subscription-integration'
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
      rejected: 'REJECTED',
      expired: 'EXPIRED',
      all: '',
    }

    const status = statusMap[tab] as any
    const campaigns = await getCampaignsByVendor(payload.userId, status || undefined)
    const features = await getSubscriptionPlanFeatures(payload.userId)

    const analytics = await Promise.all(
      campaigns
        .filter((c) => c.campaignStatus === 'ACTIVE')
        .slice(0, 5)
        .map((c) => getCampaignAnalytics(c.id))
    )

    return NextResponse.json({
      campaigns,
      features,
      analytics: analytics.filter(Boolean),
      tabs: {
        active: campaigns.filter((c) => c.campaignStatus === 'ACTIVE').length,
        pending: campaigns.filter((c) => c.campaignStatus === 'PENDING_APPROVAL').length,
        rejected: campaigns.filter((c) => c.campaignStatus === 'REJECTED').length,
        expired: campaigns.filter((c) => c.campaignStatus === 'EXPIRED').length,
      },
    })
  } catch (error) {
    logError(`Error fetching vendor advertising dashboard: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}