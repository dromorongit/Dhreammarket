// Webhook endpoint for Paystack verification payment callbacks
import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/verification-paystack'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  console.log('[Verification Webhook] Webhook received')

  try {
    const signature = request.headers.get('x-paystack-signature')
    const payload = await request.text()
    const body = JSON.parse(payload)

    if (!signature) {
      console.log('[Verification Webhook] Missing signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      console.log('[Verification Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const { event, data } = body

    // Handle relevant events
    if (event === 'charge.success' || event === 'transaction.success') {
      const reference = data.reference
      console.log('[Verification Webhook] Payment successful - reference:', reference)

      // Find the verification payment
      const payment = await getPrisma().verificationPayment.findUnique({
        where: { reference },
        include: { application: true },
      })

      if (!payment) {
        console.log('[Verification Webhook] Payment record not found for reference:', reference)
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }

      // Idempotency check - already processed
      if (payment.status === 'PAID') {
        console.log('[Verification Webhook] Payment already processed')
        return NextResponse.json({ success: true, alreadyProcessed: true })
      }

      // Update payment and application
      await getPrisma().$transaction(async (prisma: any) => {
        // Update payment status
        await prisma.verificationPayment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            completedAt: new Date(),
          },
        })

        // Update application status to PAID_PENDING_KYC
        await prisma.vendorVerificationApplication.update({
          where: { id: payment.applicationId },
          data: {
            status: 'PAID_PENDING_KYC',
            paymentStatus: 'PAID',
            paymentCompletedAt: new Date(),
          },
        })

        // Create audit log
        await prisma.verificationAuditLog.create({
          data: {
            applicationId: payment.applicationId,
            action: 'PAYMENT_SUCCESSFUL',
          },
        })
      })

      console.log('[Verification Webhook] Payment processed successfully - applicationId:', payment.applicationId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Verification Webhook] Error processing webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}