import { getPrisma } from '@/lib/prisma'
import { initializePaystackPayment, verifyPaystackPayment, isPaystackConfigured } from '@/lib/paystack'
import { logInfo, logError } from '@/lib/logger'
import { upgradeSubscription } from './subscription-service'
import { sendPaymentSuccessNotification, sendPaymentFailedNotification } from './notification-integration'
import crypto from 'crypto'

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

export interface BillingInitResult {
  success: boolean
  authorizationUrl?: string
  accessCode?: string
  reference?: string
  amount?: number
  currency?: string
  error?: string
}

export interface BillingVerificationResult {
  success: boolean
  status: string
  reference: string
  amount?: number
  currency?: string
  upgraded?: boolean
  error?: string
}

export function getSubscriptionCallbackUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ''
  return `${appUrl.replace(/\/+$/, '')}/dashboard/vendor/subscription`
}

function resolvePlanAmount(plan: { priceMonthly: number | null; priceYearly: number | null }, billingCycle: 'MONTHLY' | 'YEARLY'): number {
  const amount = billingCycle === 'YEARLY' ? (plan.priceYearly ?? 0) : (plan.priceMonthly ?? 0)
  return amount
}

export async function initializeBillingPayment(
  vendorId: string,
  vendorEmail: string,
  planName: string,
  billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY',
  callbackUrl?: string
): Promise<BillingInitResult> {
  if (!isPaystackConfigured()) {
    throw new Error('Paystack is not configured. Cannot process payment.')
  }

  const prisma = getPrisma()

  // Authoritative plan + price come from the database; a price supplied by the
  // frontend is never trusted.
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { name: planName },
    include: { featurePermissions: true },
  })
  if (!plan) {
    throw new Error(`Subscription plan "${planName}" not found`)
  }
  if (!plan.isActive) {
    throw new Error(`Subscription plan "${planName}" is not active`)
  }

  const amount = resolvePlanAmount(plan, billingCycle)
  if (amount <= 0) {
    throw new Error(`Plan "${planName}" has no price for the ${billingCycle} billing cycle`)
  }

  logInfo('Billing payment init requested', { vendorId, planName, billingCycle, amount })

  // A vendor must have a subscription to attach the payment to. Vendors that
  // never subscribed get a Free baseline so the upgrade/payment flow works.
  let subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
    include: { plan: true },
  })
  if (!subscription) {
    const freePlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'Free' } })
    if (!freePlan) {
      throw new Error('Free baseline plan is not available')
    }
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    subscription = await prisma.vendorSubscription.create({
      data: {
        vendorId,
        planId: freePlan.id,
        status: 'ACTIVE',
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextRenewalAt: periodEnd,
        autoRenew: false,
        totalPaid: 0,
      },
      include: { plan: true },
    })
    await prisma.subscriptionHistory.create({
      data: {
        subscriptionId: subscription.id,
        action: 'SUBSCRIBED',
        toPlanId: freePlan.id,
        billingCycle,
        notes: `Free baseline subscription created for upgrade to ${planName}`,
      },
    })
    logInfo(`Created Free baseline subscription: vendor=${vendorId}, subscription=${subscription.id}`)
  }

  const now = new Date()
  const periodEnd = new Date(now)
  if (billingCycle === 'YEARLY') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const invoiceNumber = `INV-${subscription.id.slice(0, 8).toUpperCase()}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`

  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      subscriptionId: subscription.id,
      invoiceNumber,
      amount,
      currency: 'GHS',
      periodStart: now,
      periodEnd,
      status: 'PENDING',
    },
  })

  // Unique, non-hardcoded transaction reference. Paystack will echo this back
  // as the transaction reference, so it is used to correlate verification.
  const reference = `SUB-${vendorId.slice(0, 8).toUpperCase()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`

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

  const metadata: Record<string, any> = {
    vendorId,
    billingCycle,
    type: 'SUBSCRIPTION',
    planName,
    targetPlanName: planName,
    subscriptionId: subscription.id,
    invoiceId: invoice.id,
    paymentId: payment.id,
  }

  const resolvedCallbackUrl = callbackUrl || getSubscriptionCallbackUrl()

  const result = await initializePaystackPayment(vendorEmail, amount, reference, resolvedCallbackUrl, metadata)

  if (result.status && result.data) {
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { paystackRef: result.data.reference },
    })
    logInfo('Billing payment initialized', {
      vendorId,
      planName,
      amount,
      reference,
      paystackRef: result.data.reference,
    })
    return {
      success: true,
      authorizationUrl: result.data.authorization_url,
      accessCode: result.data.access_code,
      reference: result.data.reference,
      amount,
      currency: 'GHS',
    }
  }

  // Initialization failed - roll back the pending DB records.
  await prisma.subscriptionInvoice.delete({ where: { id: invoice.id } })
  await prisma.subscriptionPayment.delete({ where: { id: payment.id } })
  logError('Billing payment initialization failed', undefined, { vendorId, planName, reference })
  return { success: false, error: result.message || 'Failed to initialize payment' }
}

export async function verifyBillingPayment(reference: string): Promise<BillingVerificationResult> {
  if (!isPaystackConfigured()) {
    throw new Error('Paystack is not configured')
  }

  const result = await verifyPaystackPayment(reference)

  if (!result.status || !result.data) {
    return { success: false, status: 'unknown', reference, error: result.message || 'Payment verification failed' }
  }

  const tx = result.data
  const prisma = getPrisma()

  // Locate the pending subscription payment by the Paystack reference.
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { paystackRef: reference },
    include: {
      subscription: { include: { plan: true, vendor: { select: { id: true, email: true } } } },
      invoice: true,
    },
  })

  if (!payment) {
    logError('Subscription payment record not found for verified reference', undefined, { reference })
    return { success: false, status: tx.status, reference, error: 'Payment record not found' }
  }

  // Idempotency: a payment already recorded as PAID must never be processed twice.
  if (payment.status === 'PAID') {
    logInfo('Duplicate verification ignored - payment already PAID', {
      reference,
      paymentId: payment.id,
    })
    return {
      success: true,
      status: tx.status,
      reference,
      amount: tx.amount / 100,
      currency: tx.currency,
      upgraded: false,
    }
  }

  // Non-successful transactions: record failure, keep the existing subscription, do not upgrade.
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
        notes: `Paystack verification returned status ${tx.status} for reference ${reference}`,
      },
    })
    sendPaymentFailedNotification(payment.subscription.vendorId, payment.amount, `Payment status: ${tx.status}`)
    logInfo('Subscription payment failed', { reference, status: tx.status })
    return {
      success: false,
      status: tx.status,
      reference,
      amount: tx.amount / 100,
      currency: tx.currency,
      error: `Payment status is ${tx.status}`,
    }
  }

  // tx.status === 'success' - validate before mutating any subscription state.
  const expectedPesewas = Math.round(payment.amount * 100)
  if (tx.amount !== expectedPesewas) {
    logError('Subscription payment amount mismatch', undefined, {
      reference,
      expectedPesewas,
      actualPesewas: tx.amount,
    })
    return {
      success: false,
      status: tx.status,
      reference,
      error: `Amount mismatch: expected ${expectedPesewas} pesewas, got ${tx.amount}`,
    }
  }

  if (tx.currency !== 'GHS') {
    logError('Subscription payment currency mismatch', undefined, { reference, currency: tx.currency })
    return {
      success: false,
      status: tx.status,
      reference,
      error: `Currency mismatch: expected GHS, got ${tx.currency}`,
    }
  }

  // Confirm the transaction belongs to the authenticated vendor (via metadata).
  const metadata = (tx.metadata || {}) as Record<string, any>
  const metadataVendorId = metadata.vendorId
  if (metadataVendorId && metadataVendorId !== payment.subscription.vendorId) {
    logError('Subscription payment vendor mismatch', undefined, {
      reference,
      expectedVendor: payment.subscription.vendorId,
      metadataVendor: metadataVendorId,
    })
    return { success: false, status: tx.status, reference, error: 'Vendor mismatch' }
  }

  const targetPlanName = metadata.targetPlanName as string | undefined
  const billingCycle = (metadata.billingCycle as 'MONTHLY' | 'YEARLY') || payment.subscription.billingCycle

  // The subscription is upgraded ONLY after successful server-side Paystack
  // verification. upgradeSubscription records a UPGRADED history entry itself.
  let upgraded = false
  if (targetPlanName && targetPlanName !== payment.subscription.plan.name) {
    await upgradeSubscription(payment.subscription.vendorId, targetPlanName, billingCycle)
    upgraded = true
    logInfo('Subscription upgraded after verified payment', {
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
      notes: `Payment verified via Paystack: ${reference}`,
    },
  })

  if (upgraded && targetPlanName) {
    sendPaymentSuccessNotification(payment.subscription.vendorId, payment.amount, targetPlanName)
  }

  logInfo('Subscription payment verified and subscription activated', {
    reference,
    upgraded,
    plan: targetPlanName,
  })
  return {
    success: true,
    status: tx.status,
    reference,
    amount: tx.amount / 100,
    currency: tx.currency,
    upgraded,
  }
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