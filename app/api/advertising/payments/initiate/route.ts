import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { initializeCampaignPayment, verifyCampaignPayment } from '@/lib/advertising/paystack-integration'
import { recordPayment, recordPaymentFailed, generateInvoice, getCampaignById } from '@/lib/advertising/service'
import { notifyPaymentSuccessful, notifyPaymentFailed } from '@/lib/advertising/notification-integration'
import { logInfo, logError } from '@/lib/logger'

export async function POST(
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
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const campaign = await getCampaignById(id, payload.userId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.campaignStatus !== 'PENDING_PAYMENT') {
      return NextResponse.json(
        { error: `Campaign is in ${campaign.campaignStatus} state and cannot be paid for` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { amount } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const expectedAmount = campaign.price * campaign.duration
    if (Math.abs(amount - expectedAmount) > 0.01) {
      return NextResponse.json(
        { error: `Amount mismatch: expected ${expectedAmount}, got ${amount}` },
        { status: 400 }
      )
    }

    const result = await initializeCampaignPayment(id, payload.userId, expectedAmount, {
      campaignTitle: campaign.title,
      campaignType: campaign.campaignType,
    })

    if (!result.success) {
      await recordPaymentFailed(id, expectedAmount, result.reference)
      await notifyPaymentFailed(payload.userId, campaign.title, expectedAmount)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    await logInfo(`Paystack payment initialized for campaign ${id}: ref=${result.reference}`)
    return NextResponse.json({
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode,
      reference: result.reference,
      amount: expectedAmount,
    })
  } catch (error) {
    logError(`Error initializing campaign payment: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}