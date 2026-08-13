import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyPaystackPayment } from '@/lib/paystack'
import { upgradeSubscription } from '@/lib/subscription/subscription-service'
import { sendPaymentSuccessNotification, sendPaymentFailedNotification } from '@/lib/subscription/notification-integration'
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

export async function handleSubscriptionWebhook(body: string, signature: string | undefined): Promise<NextResponse> {
  console.log('[Subscription Webhook] Webhook received')

  try {
    if (!verifyPaystackSignature(body, signature ?? undefined)) {
      console.error('[Subscription Webhook] Invalid signature - rejecting webhook')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const parsedBody = JSON.parse(body)
    const reference = parsedBody.data?.reference

    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }

    const paystackResponse = await verifyPaystackPayment(reference)

    if (!paystackResponse.status || !paystackResponse.data) {
      logError('Subscription webhook: Paystack verification failed', undefined, { reference })
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    const tx = paystackResponse.data
    const prisma = getPrisma()

    const payment = await prisma.subscriptionPayment.findFirst({
      where: { paystackRef: reference },
      include: {
        subscription: { include: { plan: true, vendor: { select: { id: true, email: true } } } },
        invoice: true,
      },
    })

    if (!payment) {
      logError('Subscription webhook: Payment record not found for verified reference', undefined, { reference })
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (payment.status === 'PAID') {
      logInfo('Subscription webhook: Duplicate verification ignored - payment already PAID', {
        reference,
        paymentId: payment.id,
      })
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }

    if (tx.status !== 'success') {
      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', paystackPaymentId: tx.reference, updatedAt: new Date() },
      })
      await prisma.subscriptionInvoice.update({
        where: { id: payment.invoiceId },
        data: { status: 'OVERDUE', updatedAt: new Date() },
      })
      await prisma.subscriptionHistory.create({
        data: {
          subscriptionId: payment.subscriptionId,
          action: 'PAYMENT_FAILED',
          amount: payment.amount,
          notes: `Paystack webhook returned status ${tx.status} for reference ${reference}`,
        },
      })
      sendPaymentFailedNotification(payment.subscription.vendorId, payment.amount, `Payment status: ${tx.status}`)
      logInfo('Subscription webhook: Payment failed', { reference, status: tx.status })
      return NextResponse.json({ received: true })
    }

    const expectedPesewas = Math.round(payment.amount * 100)
    if (tx.amount !== expectedPesewas) {
      logError('Subscription webhook: Amount mismatch', undefined, {
        reference,
        expectedPesewas,
        actualPesewas: tx.amount,
      })
      return NextResponse.json({ error: `Amount mismatch: expected ${expectedPesewas} pesewas, got ${tx.amount}` }, { status: 400 })
    }

    if (tx.currency !== 'GHS') {
      logError('Subscription webhook: Currency mismatch', undefined, { reference, currency: tx.currency })
      return NextResponse.json({ error: `Currency mismatch: expected GHS, got ${tx.currency}` }, { status: 400 })
    }

    const metadata = (tx.metadata || {}) as Record<string, any>
    const metadataVendorId = metadata.vendorId
    if (metadataVendorId && metadataVendorId !== payment.subscription.vendorId) {
      logError('Subscription webhook: Vendor mismatch', undefined, {
        reference,
        expectedVendor: payment.subscription.vendorId,
        metadataVendor: metadataVendorId,
      })
      return NextResponse.json({ error: 'Vendor mismatch' }, { status: 400 })
    }

    const targetPlanName = metadata.targetPlanName as string | undefined
    const billingCycle = (metadata.billingCycle as 'MONTHLY' | 'YEARLY') || payment.subscription.billingCycle

    let upgraded = false
    if (targetPlanName && targetPlanName !== payment.subscription.plan.name) {
      await upgradeSubscription(payment.subscription.vendorId, targetPlanName, billingCycle)
      upgraded = true
      logInfo('Subscription webhook: Subscription upgraded', {
        vendorId: payment.subscription.vendorId,
        from: payment.subscription.plan.name,
        to: targetPlanName,
      })
    }

    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: 'PAID', paystackPaymentId: tx.reference, updatedAt: new Date() },
    })
    await prisma.subscriptionInvoice.update({
      where: { id: payment.invoiceId },
      data: { status: 'PAID', paystackInvoiceId: tx.reference, updatedAt: new Date() },
    })
    await prisma.vendorSubscription.update({
      where: { id: payment.subscriptionId },
      data: {
        totalPaid: { increment: payment.amount },
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    })
    await prisma.subscriptionHistory.create({
      data: {
        subscriptionId: payment.subscriptionId,
        action: 'PAYMENT_SUCCESS',
        amount: payment.amount,
        billingCycle,
        notes: `Payment verified via webhook: ${reference}`,
      },
    })

    if (upgraded && targetPlanName) {
      sendPaymentSuccessNotification(payment.subscription.vendorId, payment.amount, targetPlanName)
    }

    logInfo('Subscription webhook: Payment verified and subscription activated', {
      reference,
      upgraded,
      plan: targetPlanName,
    })
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Subscription Webhook] Error processing webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
