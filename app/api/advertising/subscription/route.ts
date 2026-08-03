import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { getSubscriptionPlanFeatures, canVendorCreateCampaign } from '@/lib/advertising/subscription-integration'
import { logError } from '@/lib/logger'

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

    const features = await getSubscriptionPlanFeatures(payload.userId)
    const campaignCheck = await canVendorCreateCampaign(payload.userId)

    return NextResponse.json({
      features,
      canCreateCampaign: campaignCheck.allowed,
    })
  } catch (error) {
    logError(`Error fetching advertising subscription features: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}