import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import {
  createCampaign,
  getCampaignsByVendor,
  getCampaignById,
  updateCampaignStatus,
  recordPayment,
  recordPaymentFailed,
  generateInvoice,
  getCampaignAnalytics,
  expireOldCampaigns,
} from '@/lib/advertising/service'
import { canVendorCreateCampaign, getVendorCampaignLimit } from '@/lib/advertising/subscription-integration'
import { initializeCampaignPayment, verifyCampaignPayment } from '@/lib/advertising/paystack-integration'
import {
  notifyCampaignSubmitted,
  notifyCampaignApproved,
  notifyCampaignRejected,
  notifyCampaignActivated,
  notifyPaymentSuccessful,
  notifyPaymentFailed,
} from '@/lib/advertising/notification-integration'
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
    const status = searchParams.get('status') as any

    const [campaigns, limitInfo] = await Promise.all([
      getCampaignsByVendor(payload.userId, status || undefined),
      getVendorCampaignLimit(payload.userId),
    ])

    return NextResponse.json({
      campaigns,
      limit: limitInfo,
    })
  } catch (error) {
    logError(`Error fetching vendor campaigns: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      campaignType,
      selectedProductId,
      selectedServiceId,
      homepageSection,
      duration,
      price,
      maxSlots,
    } = body

    if (!title || !campaignType || !duration || !price) {
      return NextResponse.json(
        { error: 'Missing required fields: title, campaignType, duration, price' },
        { status: 400 }
      )
    }

    const subscriptionCheck = await canVendorCreateCampaign(payload.userId)
    if (!subscriptionCheck.allowed) {
      return NextResponse.json({ error: subscriptionCheck.reason }, { status: 403 })
    }

    const [campaign, limitInfo] = await Promise.all([
      createCampaign(payload.userId, {
        title,
        campaignType,
        selectedProductId,
        selectedServiceId,
        homepageSection,
        duration,
        price,
        maxSlots,
      }),
      getVendorCampaignLimit(payload.userId),
    ])

    if (limitInfo.maxCampaigns > 0 && limitInfo.currentCampaigns >= limitInfo.maxCampaigns) {
      return NextResponse.json(
        { error: `Campaign limit of ${limitInfo.maxCampaigns} reached for your plan` },
        { status: 403 }
      )
    }

    await notifyCampaignSubmitted(payload.userId, campaign.title, campaign.id)

    logInfo(`Campaign created: id=${campaign.id}, vendor=${payload.userId}`)
    return NextResponse.json({ campaign, limit: limitInfo }, { status: 201 })
  } catch (error) {
    logError(`Error creating campaign: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}