import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { verifyCampaignPayment } from '@/lib/advertising/paystack-integration'
import { recordPayment, recordPaymentFailed, getCampaignById } from '@/lib/advertising/service'
import { generateInvoice } from '@/lib/advertising/service'
import { notifyPaymentSuccessful } from '@/lib/advertising/notification-integration'
import { logInfo, logError } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { reference, campaignId } = body

    if (!reference || !campaignId) {
      return NextResponse.json(
        { error: 'Missing reference or campaignId' },
        { status: 400 }
      )
    }

    const verification = await verifyCampaignPayment(reference)
    if (!verification.success) {
      await recordPaymentFailed(campaignId, 0, reference)
      return NextResponse.json({ error: 'Payment verification failed', details: verification }, { status: 400 })
    }

    const campaign = await getCampaignById(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.vendorId !== payload.userId && payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const amount = verification.amount || campaign.price

    await Promise.all([
      recordPayment(campaignId, amount, reference, verification.reference || ''),
      generateInvoice(campaignId),
      notifyPaymentSuccessful(campaign.vendorId, campaign.title, amount, reference),
    ])

    await updateCampaignToPendingApproval(campaignId)

    logInfo(`Payment verified for campaign ${campaignId}: ref=${reference}`)
    return NextResponse.json({ success: true, campaignId, reference, amount })
  } catch (error) {
    logError(`Error verifying campaign payment: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function updateCampaignToPendingApproval(campaignId: string) {
  const prisma = getPrisma()
  await prisma.advertisementCampaign.update({
    where: { id: campaignId },
    data: {
      campaignStatus: 'PENDING_APPROVAL',
      paymentStatus: 'PAID',
      updatedAt: new Date(),
    },
  })
}