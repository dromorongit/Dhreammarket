import crypto from 'crypto'
import { getPrisma } from '@/lib/prisma'
import { initializePaystackPayment } from '@/lib/paystack'
import { SITE_URL } from '@/lib/site-config'
import { buildReceiptUrl, orderDisplayNumber } from '@/lib/manual-orders'

const LIVE_PENDING_LINK_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type EnsurePayLinkResult =
  | {
      ok: true
      authorizationUrl: string | null
      reference: string | null
      receiptUrl: string
      paymentStatus: 'PAID' | 'UNPAID'
    }
  | { ok: false; status: number; error: string }

interface ManualOrderForPayLink {
  id: string
  source: string
  status: string
  paymentStatus: string
  total: number
  receiptToken: string | null
  customerEmail: string | null
  storeId: string
}

function isFreshPendingLink(payment: { updatedAt?: Date | null; createdAt?: Date | null } | null): boolean {
  if (!payment) return false
  const stamp = payment.updatedAt ?? payment.createdAt
  if (!stamp) return false
  return Date.now() - stamp.getTime() < LIVE_PENDING_LINK_MAX_AGE_MS
}

export async function ensurePayLinkForOrder(order: ManualOrderForPayLink): Promise<EnsurePayLinkResult> {
  if (!order.receiptToken) {
    return { ok: false, status: 400, error: 'Receipt is not available for this order' }
  }

  const receiptUrl = buildReceiptUrl(order.receiptToken)

  if (order.source !== 'MANUAL') {
    return { ok: false, status: 409, error: 'Only manual orders can receive a pay link' }
  }

  if (order.status === 'CANCELLED') {
    return { ok: false, status: 409, error: 'Cannot create a pay link for a cancelled order' }
  }

  if (!(order.total > 0)) {
    return { ok: false, status: 400, error: 'Order total must be greater than 0' }
  }

  if (order.paymentStatus === 'PAID') {
    return {
      ok: true,
      authorizationUrl: null,
      reference: null,
      receiptUrl,
      paymentStatus: 'PAID',
    }
  }

  const existingPayment = await getPrisma().payment.findUnique({
    where: { orderId: order.id },
    select: {
      id: true,
      reference: true,
      amount: true,
      status: true,
      authorizationUrl: true,
      updatedAt: true,
      createdAt: true,
    },
  })

  if (
    existingPayment &&
    (existingPayment.status as string) === 'PAID' &&
    (order.paymentStatus as string) !== 'PAID'
  ) {
    return { ok: false, status: 409, error: 'payment received, needs review' }
  }

  const amountMatches =
    !!existingPayment &&
    existingPayment.status === 'PENDING' &&
    !!existingPayment.authorizationUrl &&
    Math.abs(existingPayment.amount - order.total) <= 0.01

  if (amountMatches && isFreshPendingLink(existingPayment)) {
    return {
      ok: true,
      authorizationUrl: existingPayment.authorizationUrl,
      reference: existingPayment.reference,
      receiptUrl,
      paymentStatus: 'UNPAID',
    }
  }

  const rawDomain = process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN
  let domain = rawDomain?.trim().toLowerCase()
  if (domain) {
    const lastAt = domain.lastIndexOf('@')
    if (lastAt !== -1) domain = domain.slice(lastAt + 1)
    if (domain.startsWith('www.')) domain = domain.slice(4)
  }

  const email =
    order.customerEmail ||
    (domain ? `pay+${orderDisplayNumber(order.id)}@${domain}` : undefined)

  if (!email) {
    if (rawDomain) {
      console.warn('[pay-link] fallback email setting is invalid:', rawDomain)
    }
    return {
      ok: false,
      status: 400,
      error: 'Customer email is missing and the fallback email setting is invalid',
    }
  }

  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
  if (!emailRegex.test(email)) {
    console.warn('[pay-link] invalid fallback email:', email)
    return {
      ok: false,
      status: 400,
      error: 'Customer email is missing and the fallback email setting is invalid',
    }
  }

  const reference = `MAN-${crypto.randomBytes(8).toString('hex').toUpperCase()}`

  let paystackResponse
  try {
    paystackResponse = await initializePaystackPayment(
      email,
      order.total,
      reference,
      `${SITE_URL}/receipt/${order.receiptToken}`,
      { orderId: order.id, source: 'MANUAL', storeId: order.storeId }
    )
  } catch (error) {
    console.error('[pay-link] Paystack error:', error)
    return { ok: false, status: 502, error: 'Unable to create pay link. Please try again.' }
  }

  const authorizationUrl = paystackResponse.data.authorization_url
  const paystackRef = paystackResponse.data.reference

  const payment = await getPrisma().payment.upsert({
    where: { orderId: order.id },
    update: {
      reference,
      amount: order.total,
      currency: 'GHS',
      status: 'PENDING',
      userId: null,
      paystackRef,
      authorizationUrl,
    },
    create: {
      orderId: order.id,
      userId: null,
      amount: order.total,
      currency: 'GHS',
      status: 'PENDING',
      reference,
      paystackRef,
      authorizationUrl,
    },
  })

  return {
    ok: true,
    authorizationUrl: payment.authorizationUrl,
    reference: payment.reference,
    receiptUrl,
    paymentStatus: 'UNPAID',
  }
}
