import { getPrisma } from '@/lib/prisma'
import { initializePaystackPayment, verifyPaystackPayment, isPaystackConfigured } from '@/lib/paystack'
import { logInfo, logError } from '@/lib/logger'
import { randomUUID } from 'crypto'

export interface BillingInvoiceData {
  subscriptionId: string
  vendorId: string
  vendorEmail: string
  planName: string
  billingCycle: string
  amount: number
  periodStart: Date
  periodEnd: Date
}

export async function initializeBillingPayment(
  vendorId: string,
  vendorEmail: string,
  amount: number,
  billingCycle: string,
  callbackUrl?: string
) {
  if (!isPaystackConfigured()) {
    throw new Error('Paystack is not configured. Cannot process payment.')
  }

  const reference = `SUB-${vendorId.slice(0, 8).toUpperCase()}-${Date.now()}`

  const metadata = {
    vendorId,
    billingCycle,
    type: 'SUBSCRIPTION',
  }

  const result = await initializePaystackPayment(
    vendorEmail,
    amount,
    reference,
    callbackUrl,
    metadata
  )

  logInfo(`Billing payment initialized: vendor=${vendorId}, amount=${amount}, ref=${reference}`)
  return { ...result, reference }
}

export async function verifyBillingPayment(reference: string) {
  if (!isPaystackConfigured()) {
    throw new Error('Paystack is not configured')
  }

  const result = await verifyPaystackPayment(reference)

  if (result.status && result.data.status === 'success') {
    const metadata = result.data.metadata
    if (metadata?.type === 'SUBSCRIPTION') {
      const prisma = getPrisma()
      const payment = await prisma.subscriptionPayment.findFirst({
        where: { paystackRef: reference },
        include: { subscription: true, invoice: true },
      })

      if (payment) {
        await prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            paystackPaymentId: result.data.reference,
          },
        })

        await prisma.subscriptionInvoice.update({
          where: { id: payment.invoiceId },
          data: {
            status: 'PAID',
            paystackInvoiceId: result.data.reference,
          },
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
            notes: `Payment verified via Paystack: ${reference}`,
          },
        })

        logInfo(`Billing payment verified and subscription activated: ref=${reference}`)
      }
    }
  }

  return result
}

export async function createManualRenewalInvoice(subscriptionId: string) {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, vendor: { select: { email: true } } },
  })
  if (!subscription) {
    throw new Error('Subscription not found')
  }

  const plan = subscription.plan
  const amount = subscription.billingCycle === 'YEARLY' ? (plan.priceYearly ?? 0) : (plan.priceMonthly ?? 0)
  if (amount <= 0) {
    throw new Error('Free plan does not require manual payment')
  }

  const now = new Date()
  const invoiceNumber = `INV-${subscription.id.slice(0, 8).toUpperCase()}-MANUAL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      subscriptionId,
      invoiceNumber,
      amount,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      status: 'PENDING',
    },
  })

  await prisma.subscriptionHistory.create({
    data: {
      subscriptionId,
      action: 'INVOICE_GENERATED',
      amount,
      notes: `Manual renewal invoice ${invoiceNumber} generated`,
    },
  })

  logInfo(`Manual renewal invoice created: ${invoiceNumber}, amount=${amount}`)
  return invoice
}

export async function processManualPayment(subscriptionId: string, amount: number, paymentMethod: string = 'MANUAL') {
  const prisma = getPrisma()
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { id: subscriptionId },
  })
  if (!subscription) {
    throw new Error('Subscription not found')
  }

  const pendingInvoice = await prisma.subscriptionInvoice.findFirst({
    where: {
      subscriptionId,
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  })

  const invoice = pendingInvoice ?? await prisma.subscriptionInvoice.create({
    data: {
      subscriptionId,
      invoiceNumber: `INV-${subscription.id.slice(0, 8).toUpperCase()}-${Date.now()}`,
      amount,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      status: 'PAID',
    },
  })

  if (!pendingInvoice) {
    await prisma.subscriptionInvoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID' },
    })
  }

  await prisma.subscriptionPayment.create({
    data: {
      invoiceId: invoice.id,
      subscriptionId,
      amount,
      status: 'PAID',
      paymentMethod,
    },
  })

  await prisma.vendorSubscription.update({
    where: { id: subscriptionId },
    data: {
      totalPaid: { increment: amount },
      status: 'ACTIVE',
      updatedAt: new Date(),
    },
  })

  await prisma.subscriptionHistory.create({
    data: {
      subscriptionId,
      action: 'PAYMENT_SUCCESS',
      amount,
      notes: `Manual payment received via ${paymentMethod}`,
    },
  })

  logInfo(`Manual payment processed: subscription=${subscriptionId}, amount=${amount}`)
  return { invoice, payment: invoice.payments[0] }
}