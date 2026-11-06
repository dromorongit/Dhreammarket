import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyPaystackPayment, type PaystackVerifyResponse } from '@/lib/paystack'
import { checkPaystackAmount } from '@/lib/payment-checks'
import { createAuditLog } from '@/lib/audit-log'
import { createNotification } from '@/lib/notifications'
import { invalidateSalesSummaryCache } from '@/lib/sales-summary-cache'
import { PAYSTACK_FEE_PERCENTAGE } from '@/lib/site-config'
import { orderDisplayNumber } from '@/lib/manual-orders'
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

async function notifySuperAdmins(title: string, message: string): Promise<void> {
  const superAdmins = await getPrisma().user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  })
  for (const admin of superAdmins) {
    await createNotification(admin.id, 'ORDER_STATUS_UPDATED', title, message).catch(() => {})
  }
}

export async function handleManualOrderWebhook(
  body: string,
  signature: string | undefined
): Promise<NextResponse> {
  try {
    if (!verifyPaystackSignature(body, signature ?? undefined)) {
      console.error('[Manual Order Webhook] Invalid signature - rejecting webhook')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const parsedBody = JSON.parse(body)
    const reference = parsedBody.data?.reference

    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }

    let payment = await getPrisma().payment.findUnique({
      where: { reference },
      include: { order: true },
    })

    let paystackResponse: PaystackVerifyResponse | null = null

    if (!payment) {
      paystackResponse = await verifyPaystackPayment(reference)
      const metadataOrderId = paystackResponse.data.metadata?.orderId as string | undefined
      if (metadataOrderId) {
        const byOrderId = await getPrisma().payment.findUnique({
          where: { orderId: metadataOrderId },
          include: { order: true },
        })
        if (byOrderId && byOrderId.reference !== reference) {
          await notifySuperAdmins(
            'Replaced pay-link reference',
            `Order ${metadataOrderId} has payment reference ${byOrderId.reference} but webhook reference is ${reference}. Reference: ${reference}`
          )
          return NextResponse.json({ received: true, needsAttention: true, reason: 'replaced-reference' })
        }
        payment = byOrderId
      }
    }

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (!paystackResponse) {
      paystackResponse = await verifyPaystackPayment(reference)
    }

    const order = payment.order
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const paymentStatus = paystackResponse.data.status

    // Claim atomically: only PENDING payments can be claimed
    const claimResult = await getPrisma().payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'PAID', paystackRef: reference },
    })

    if (claimResult.count === 0) {
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }

    if (paymentStatus !== 'success') {
      const failedStatus = paymentStatus === 'abandoned' || paymentStatus === 'cancelled' ? 'CANCELLED' : 'FAILED'
      await getPrisma().payment.update({
        where: { id: payment.id },
        data: { status: failedStatus, message: `Payment ${paymentStatus} via webhook` },
      })
      return NextResponse.json({ received: true })
    }

    // Amount and currency validation against Paystack's charged amount.
    const amountCheck = checkPaystackAmount(paystackResponse.data, payment)
    if (amountCheck.wrongCurrency || amountCheck.underpaid) {
      // The payment was claimed above; reset it so the vendor can retry or
      // confirm the underpaid/overpaid amount manually.
      await getPrisma().payment.update({
        where: { id: payment.id },
        data: { status: 'PENDING', message: 'Amount mismatch; awaiting vendor review' },
      })
      await notifySuperAdmins(
        'Manual order payment amount mismatch',
        `Order ${order.id} received ${amountCheck.paystackAmountGhs} ${paystackResponse.data.currency} but expected ${amountCheck.storedAmountGhs} ${payment.currency}. Reference: ${reference}`
      )
      return NextResponse.json({
        received: true,
        needsAttention: true,
        reason: 'amount-mismatch',
        amountCheck,
      })
    }

    const isOverpaid = amountCheck.overpaid
    if (isOverpaid) {
      const excessGhs = Math.round((amountCheck.paystackAmountGhs - amountCheck.storedAmountGhs) * 100) / 100
      await notifySuperAdmins(
        'Manual order payment overpaid',
        `Order ${order.id} was overpaid: Paystack charged ${amountCheck.paystackAmountGhs} GHS, expected ${amountCheck.storedAmountGhs} GHS. Excess: ${excessGhs} GHS. Reference: ${reference}`
      )
    }

    // Flag needs-attention without changing the order if already finalized
    if (order.status === 'CANCELLED' || order.paymentStatus === 'PAID') {
      await notifySuperAdmins(
        'Manual order already finalized',
        `Order ${order.id} is ${order.status} with paymentStatus ${order.paymentStatus}. Reference: ${reference}`
      )
      return NextResponse.json({ received: true, needsAttention: true, reason: 'order-finalized' })
    }

    // Compute earnings with 0% platform commission for manual orders.
    // For overpaid payments, grossAmount is the order total (not the amount paid).
    const grossAmount = isOverpaid ? order.total : Math.round((paystackResponse.data.amount / 100) * 100) / 100
    let processorFee: number
    const paystackFeesPesewas = paystackResponse.data.fees
    if (paystackFeesPesewas !== null && paystackFeesPesewas !== undefined && paystackFeesPesewas > 0) {
      processorFee = Math.round(paystackFeesPesewas) / 100
    } else {
      processorFee = Math.round((grossAmount * PAYSTACK_FEE_PERCENTAGE) * 100) / 100
    }
    const netAmount = Math.round((grossAmount - processorFee) * 100) / 100
    const platformCommission = 0
    const commissionRate = 0
    const vendorEarnings = netAmount

    const now = new Date()

    let orderClaimed = false

    await getPrisma().$transaction(async (tx) => {
      // First write: claim the order atomically. Only proceed if the order is
      // not already PAID and not CANCELLED.
      const orderClaim = await tx.order.updateMany({
        where: {
          id: order.id,
          paymentStatus: { not: 'PAID' },
          status: { not: 'CANCELLED' },
        },
        data: {
          paymentStatus: 'PAID',
          paymentConfirmedAt: now,
          status: 'PROCESSING',
          paymentMethod: 'PAYSTACK',
        },
      })

      if (orderClaim.count === 0) {
        orderClaimed = false
        return
      }

      orderClaimed = true

      // Earnings fields on the order row.
      await tx.order.update({
        where: { id: order.id },
        data: {
          grossAmount,
          processorFee,
          netAmount,
          platformCommission,
          vendorEarnings,
          commissionRate,
        },
      })

      const orderItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
      })

      for (const item of orderItems) {
        const itemGross = item.price * item.quantity
        const itemProcessorFee = grossAmount > 0 ? Math.round((itemGross / grossAmount) * processorFee * 100) / 100 : 0
        const itemNetAmount = Math.round((itemGross - itemProcessorFee) * 100) / 100

        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            grossAmount: itemGross,
            processorFee: itemProcessorFee,
            netAmount: itemNetAmount,
            platformCommission: 0,
            vendorEarnings: itemNetAmount,
            commissionRate: 0,
          },
        })
      }
    })

    if (!orderClaimed) {
      await notifySuperAdmins(
        'Manual order already finalized',
        `Order ${order.id} could not be claimed (paymentStatus or status already terminal). Reference: ${reference}`
      )
      return NextResponse.json({ received: true, needsAttention: true, reason: 'order-finalized' })
    }

    // Post-transaction side effects wrapped so they can never turn a
    // successful payment into a 500.

    // Resolve the store owner (manual orders have payment.userId === null).
    let storeOwnerId: string | null = null
    let storeName: string | null = null
    let storeId: string | null = null
    try {
      const storeItem = await getPrisma().orderItem.findFirst({
        where: { orderId: order.id },
        select: {
          product: {
            select: {
              store: {
                select: { id: true, userId: true, name: true },
              },
            },
          },
        },
      })
      storeOwnerId = storeItem?.product?.store?.userId ?? null
      storeName = storeItem?.product?.store?.name ?? null
      storeId = storeItem?.product?.store?.id ?? null
    } catch {
      // best-effort only
    }

    // Audit log against the store owner (payment.userId is null for manual orders).
    if (storeOwnerId) {
      try {
        await createAuditLog({
          userId: storeOwnerId,
          userRole: 'SYSTEM',
          action: 'PAYMENT_CONFIRMED',
          entityType: 'ORDER',
          entityId: order.id,
          afterData: {
            paymentId: payment.id,
            reference,
            amount: payment.amount,
          },
        })
      } catch {
        // best-effort only
      }
    } else {
      console.warn(`[Manual Order Webhook] Skipping audit log: no store owner userId for order ${order.id}`)
    }

    // Notify the vendor that the manual order is paid.
    try {
      if (storeOwnerId) {
        const customerName = `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim() || 'Customer'
        await createNotification(
          storeOwnerId,
          'ORDER_STATUS_UPDATED',
          `Order paid - ${orderDisplayNumber(order.id)}`,
          `Order ${orderDisplayNumber(order.id)} for ${customerName} paid: GHS ${order.total.toFixed(2)}.`
        )
      }
    } catch {
      // best-effort only
    }

    try {
      if (storeId) {
        invalidateSalesSummaryCache(storeId)
      }
    } catch {
      // best-effort only
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing manual order webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
