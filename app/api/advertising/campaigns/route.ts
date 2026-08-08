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
    if (!payload || (payload.role !== 'VENDOR' && payload.role !== 'SUPER_ADMIN')) {
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
      vendorId,
      campaignStatus,
    } = body

    if (!title || !campaignType || !duration || !price) {
      return NextResponse.json(
        { error: 'Missing required fields: title, campaignType, duration, price' },
        { status: 400 }
      )
    }

    const targetVendorId = payload.role === 'SUPER_ADMIN' ? vendorId : payload.userId
    if (!targetVendorId) {
      return NextResponse.json({ error: 'vendorId is required for admin campaign creation' }, { status: 400 })
    }

    const prisma = getPrisma()

    if (payload.role === 'VENDOR') {
      await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payload.userId}))`

      const subscriptionCheck = await canVendorCreateCampaign(payload.userId)
      if (!subscriptionCheck.allowed) {
        return NextResponse.json({ error: subscriptionCheck.reason }, { status: 403 })
      }

      const limitInfo = await getVendorCampaignLimit(payload.userId)
      if (limitInfo.maxCampaigns > 0 && limitInfo.currentCampaigns >= limitInfo.maxCampaigns) {
        return NextResponse.json(
          { error: `Campaign limit of ${limitInfo.maxCampaigns} reached for your plan` },
          { status: 403 }
        )
      }

      if (selectedProductId) {
        const product = await getPrisma().product.findUnique({
          where: { id: selectedProductId },
          select: { id: true, storeId: true },
        })
        if (!product) {
          return NextResponse.json({ error: 'Selected product not found' }, { status: 400 })
        }
        const store = await getPrisma().store.findUnique({
          where: { id: product.storeId },
          select: { userId: true },
        })
        if (!store || store.userId !== payload.userId) {
          return NextResponse.json({ error: 'Selected product does not belong to your store' }, { status: 400 })
        }
      }

      if (selectedServiceId) {
        const service = await getPrisma().service.findUnique({
          where: { id: selectedServiceId },
          select: { id: true, vendorId: true },
        })
        if (!service) {
          return NextResponse.json({ error: 'Selected service not found' }, { status: 400 })
        }
        if (service.vendorId !== payload.userId) {
          return NextResponse.json({ error: 'Selected service does not belong to your store' }, { status: 400 })
        }
      }
    }

    const initialStatus = payload.role === 'SUPER_ADMIN' && campaignStatus
      ? campaignStatus
      : 'PENDING_PAYMENT'

    const validStatuses: string[] = ['PENDING_PAYMENT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE']
    if (!validStatuses.includes(initialStatus)) {
      return NextResponse.json({ error: `Invalid initial status: ${initialStatus}` }, { status: 400 })
    }

    const campaign = await createCampaign(targetVendorId, {
      title,
      campaignType,
      selectedProductId,
      selectedServiceId,
      homepageSection,
      duration,
      price,
      maxSlots,
      campaignStatus: initialStatus,
    }, payload.role)

    await notifyCampaignSubmitted(targetVendorId, campaign.title, campaign.id)

    logInfo(`Campaign created: id=${campaign.id}, vendor=${targetVendorId}, by=${payload.role}, status=${initialStatus}`)
    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    logError(`Error creating campaign: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}