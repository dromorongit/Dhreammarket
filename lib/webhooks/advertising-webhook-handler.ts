import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyPaystackPayment } from '@/lib/paystack'
import { recordPayment, recordPaymentFailed, generateInvoice, getCampaignById, updateCampaignStatus } from '@/lib/advertising/service'
import { notifyPaymentSuccessful, notifyPaymentFailed } from '@/lib/advertising/notification-integration'
import { logInfo, logError } from '@/lib/logger'
import crypto from 'crypto'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

function verifyPaystackSignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false
  if (!PAYSTACK_SECRET_KEY) return false

  const expectedSignature = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}

export async function handleAdvertisingWebhook(body: string, signature: string | undefined): Promise<NextResponse> {
  console.log('[Advertising Webhook] Webhook received')

  try {
    if (!verifyPaystackSignature(body, signature ?? undefined)) {
      console.error('[Advertising Webhook] Invalid signature - rejecting webhook')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const parsedBody = JSON.parse(body)
    const reference = parsedBody.data?.reference

    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }

    const prisma = getPrisma()

    const payment = await prisma.advertisementPayment.findFirst({
      where: { paystackRef: reference },
      include: {
        campaign: { include: { vendor: { select: { id: true, email: true } } } },
      },
    })

    if (payment?.status === 'PAID') {
      logInfo('Advertising webhook: Duplicate verification ignored - payment already PAID', {
        reference,
        paymentId: payment.id,
      })
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }

    const paystackResponse = await verifyPaystackPayment(reference)

    if (!paystackResponse.status || !paystackResponse.data) {
      logError('Advertising webhook: Paystack verification failed', undefined, { reference })
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    const txData = paystackResponse.data

    if (txData.status !== 'success') {
      if (payment) {
        await prisma.advertisementPayment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', paystackPaymentId: txData.reference, updatedAt: new Date() },
        })
        await prisma.advertisementCampaign.update({
          where: { id: payment.campaignId },
          data: { paymentStatus: 'FAILED', updatedAt: new Date() },
        })
        await prisma.advertisementHistory.create({
          data: {
            campaignId: payment.campaignId,
            action: 'PAYMENT_FAILED',
            performedBy: payment.campaignId,
            performedByRole: 'SYSTEM',
            details: { amount: payment.amount, paystackRef: reference, reason: `Paystack webhook returned status ${txData.status}` },
          },
        })
        await notifyPaymentFailed(payment.campaign.vendorId, payment.campaign.title, payment.amount)
        logInfo('Advertising webhook: Payment failed', { reference, status: txData.status })
      }
      return NextResponse.json({ received: true })
    }

    const expectedPesewas = payment ? Math.round(payment.amount * 100) : undefined
    if (expectedPesewas && txData.amount !== expectedPesewas) {
      logError('Advertising webhook: Amount mismatch', undefined, {
        reference,
        expectedPesewas,
        actualPesewas: txData.amount,
      })
      return NextResponse.json({ error: `Amount mismatch: expected ${expectedPesewas} pesewas, got ${txData.amount}` }, { status: 400 })
    }

    if (txData.currency !== 'GHS') {
      logError('Advertising webhook: Currency mismatch', undefined, { reference, currency: txData.currency })
      return NextResponse.json({ error: `Currency mismatch: expected GHS, got ${txData.currency}` }, { status: 400 })
    }

    const campaign = payment?.campaign
    if (!campaign) {
      logError('Advertising webhook: Campaign not found for verified payment', undefined, { reference })
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const metadata = (txData.metadata || {}) as Record<string, any>
    const metadataVendorId = metadata.vendorId
    if (metadataVendorId && metadataVendorId !== campaign.vendorId) {
      logError('Advertising webhook: Vendor mismatch', undefined, {
        reference,
        expectedVendor: campaign.vendorId,
        metadataVendor: metadataVendorId,
      })
      return NextResponse.json({ error: 'Vendor mismatch' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingPayment = await tx.advertisementPayment.findFirst({
        where: { paystackRef: reference },
      })

      if (existingPayment?.status === 'PAID') {
        logInfo('Advertising webhook: Duplicate verification inside transaction - already PAID', {
          reference,
          paymentId: existingPayment.id,
        })
        return { alreadyProcessed: true }
      }

      let paymentRecord
      if (existingPayment) {
        paymentRecord = await tx.advertisementPayment.update({
          where: { id: existingPayment.id },
          data: { status: 'PAID', paystackPaymentId: txData.reference, updatedAt: new Date() },
        })
      } else {
        paymentRecord = await tx.advertisementPayment.create({
          data: {
            campaignId: campaign.id,
            amount: txData.amount / 100,
            currency: 'GHS',
            paystackRef: reference,
            paystackPaymentId: txData.reference,
            status: 'PAID',
            metadata,
          },
        })
      }

      await generateInvoice(campaign.id)

      await tx.advertisementCampaign.update({
        where: { id: campaign.id },
        data: { paymentStatus: 'PAID', updatedAt: new Date() },
      })

      await tx.advertisementHistory.create({
        data: {
          campaignId: campaign.id,
          action: 'PAYMENT_SUCCESS',
          performedBy: campaign.vendorId,
          performedByRole: 'SYSTEM',
          details: { amount: paymentRecord.amount, paystackRef: reference, paystackPaymentId: txData.reference },
        },
      })

      await updateCampaignStatus(campaign.id, 'PENDING_APPROVAL', campaign.vendorId, 'SYSTEM', { action: 'PAYMENT_SUCCESS', paystackRef: reference })
      await notifyPaymentSuccessful(campaign.vendorId, campaign.title, paymentRecord.amount, reference)

      logInfo('Advertising webhook: Payment verified and campaign queued for approval', {
        reference,
        campaignId: campaign.id,
        amount: paymentRecord.amount,
      })
      return { alreadyProcessed: false }
    })

    if (result.alreadyProcessed) {
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Advertising Webhook] Error processing webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
