import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import {
  getCampaignById,
  updateCampaignStatus,
  recordPayment,
  recordPaymentFailed,
  generateInvoice,
  getCampaignAnalytics,
  expireOldCampaigns,
} from '@/lib/advertising/service'
import {
  initializeCampaignPayment,
  verifyCampaignPayment,
} from '@/lib/advertising/paystack-integration'
import {
  notifyCampaignApproved,
  notifyCampaignRejected,
  notifyCampaignActivated,
  notifyPaymentSuccessful,
  notifyPaymentFailed,
} from '@/lib/advertising/notification-integration'
import { logInfo, logError } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const campaign = await getCampaignById(id)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (payload.role !== 'SUPER_ADMIN' && campaign.vendorId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ campaign })
  } catch (error) {
    logError(`Error fetching campaign: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { campaignStatus, rejectedReason } = body

    if (!campaignStatus) {
      return NextResponse.json({ error: 'Missing campaignStatus' }, { status: 400 })
    }

    const details: Record<string, any> = { actionBy: payload.userId, actionRole: payload.role }
    if (rejectedReason) details.rejectedReason = rejectedReason

    const campaign = await updateCampaignStatus(
      id,
      campaignStatus,
      payload.userId,
      payload.role,
      details
    )

    if (campaignStatus === 'APPROVED') {
      await notifyCampaignApproved(campaign.vendorId, campaign.title, campaign.id)
    } else if (campaignStatus === 'REJECTED') {
      await notifyCampaignRejected(campaign.vendorId, campaign.title, campaign.id, rejectedReason || '')
    } else if (campaignStatus === 'ACTIVE') {
      await notifyCampaignActivated(campaign.vendorId, campaign.title, campaign.id)
    }

    logInfo(`Campaign ${id} status updated to ${campaignStatus} by admin ${payload.userId}`)
    return NextResponse.json({ campaign })
  } catch (error) {
    logError(`Error updating campaign: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}