import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/verification-paystack'

export async function handleVerificationWebhook(body: string, signature: string | undefined): Promise<NextResponse> {
  console.log('[Verification Webhook] Webhook received')

  try {
    if (!signature) {
      console.log('[Verification Webhook] Missing signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    if (!verifyWebhookSignature(body, signature)) {
      console.log('[Verification Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const parsedBody = JSON.parse(body)
    const { event, data } = parsedBody

    if (event === 'charge.success' || event === 'transaction.success') {
      const reference = data.reference
      console.log('[Verification Webhook] Payment successful - reference:', reference)

      const payment = await getPrisma().verificationPayment.findUnique({
        where: { reference },
        include: { application: true },
      })

      if (!payment) {
        console.log('[Verification Webhook] Payment record not found for reference:', reference)
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }

      if (payment.status === 'PAID') {
        console.log('[Verification Webhook] Payment already processed')
        return NextResponse.json({ success: true, alreadyProcessed: true })
      }

      await getPrisma().$transaction(async (prisma: any) => {
        await prisma.verificationPayment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            completedAt: new Date(),
          },
        })

        await prisma.vendorVerificationApplication.update({
          where: { id: payment.applicationId },
          data: {
            status: 'PAID_PENDING_KYC',
            paymentStatus: 'PAID',
            paymentCompletedAt: new Date(),
          },
        })

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
