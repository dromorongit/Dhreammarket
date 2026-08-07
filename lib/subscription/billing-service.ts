import { getPrisma } from '@/lib/prisma'
import { initializePaystackPayment, verifyPaystackPayment, isPaystackConfigured } from '@/lib/paystack'
import { logInfo, logError } from '@/lib/logger'
import { upgradeSubscription } from './subscription-service'

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
  callbackUrl?: string,
  targetPlanName?: string
) {
  if (!isPaystackConfigured()) {
    throw new Error('Paystack is not configured. Cannot process payment.')
  }

  const prisma = getPrisma()

  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) {
    throw new Error('No subscription found for vendor')
  }

  const now = new Date()
  const periodStart = subscription.currentPeriodStart
  const periodEnd = subscription.currentPeriodEnd

  const invoiceNumber = `INV-${subscription.id.slice(0, 8).toUpperCase()}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`

  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      subscriptionId: subscription.id,
      invoiceNumber,
      amount,
      periodStart,
      periodEnd,
      status: 'PENDING',
    },
  })

  const payment = await prisma.subscriptionPayment.create({
    data: {
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      amount,
      currency: 'GHS',
      status: 'PENDING',
      paymentMethod: 'PAYSTACK',
    },
  })

  const reference = `SUB-${vendorId.slice(0, 8).toUpperCase()}-${Date.now()}`

  const metadata: Record<string, any> = {
    vendorId,
    billingCycle,
    type: 'SUBSCRIPTION',
    subscriptionId: subscription.id,
    invoiceId: invoice.id,
    paymentId: payment.id,
  }
  if (targetPlanName) {
    metadata.targetPlanName = targetPlanName
  }

  const result = await initializePaystackPayment(
    vendorEmail,
    amount,
    reference,
    callbackUrl,
    metadata
  )

  if (result.status && result.data) {
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { paystackRef: result.data.reference },
    })
    logInfo(`Billing payment initialized: vendor=${vendorId}, amount=${amount}, ref=${reference}, targetPlan=${targetPlanName ?? 'none'}`)
    return { ...result, reference }
  }

  await prisma.subscriptionInvoice.delete({ where: { id: invoice.id } })
  await prisma.subscriptionPayment.delete({ where: { id: payment.id } })
  logError(`Billing payment initialization failed: vendor=${vendorId}, ref=${reference}`)
  return { success: false, error: result.message || 'Failed to initialize payment' }
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

      let payment = await prisma.subscriptionPayment.findFirst({
        where: { paystackRef: reference },
        include: { subscription: true, invoice: true },
      })

      if (!payment) {
        logError(`Subscription payment not found for reference: ${reference}`)
        return result
      }

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

      if (metadata.targetPlanName) {
        try {
          await upgradeSubscription(payment.subscription.vendorId, metadata.targetPlanName, metadata.billingCycle || 'MONTHLY')
          logInfo(`Subscription upgraded after payment: vendor=${payment.subscription.vendorId}, plan=${metadata.targetPlanName}`)
        } catch (upgradeErr) {
          logError(`Failed to upgrade subscription after payment: ${upgradeErr}`)
        }
      }

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

  const invoiceWithPayments = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoice.id },
    include: { payments: true },
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
  return { invoice, payment: invoiceWithPayments?.payments[0] ?? null }
}