import { getPrisma } from '@/lib/prisma'
import { reserveStock } from '@/lib/stock-reservation'
import { checkPaystackAmount } from '@/lib/payment-checks'
import { createRefund } from '@/lib/refunds/refund-service'
import { createNotification } from '@/lib/notifications'
import { sendPaymentConfirmationEmail } from '@/lib/email'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { createAuditLog } from '@/lib/audit-log'
import { logError, logInfo } from '@/lib/logger'

export type LatePaymentResult = {
  fulfilled: boolean
  alreadyProcessed: boolean
  needsAttention: boolean
}

/**
 * Handle a successful Paystack payment that arrives for an order the expiry
 * cron already cancelled (CANCELLED + FAILED payment).
 *
 * Idempotent: the first caller to atomically flip CANCELLED -> PROCESSING
 * proceeds; concurrent calls for the same order see count === 0 and return
 * alreadyProcessed.
 */
/**
 * Handle a successful Paystack payment that arrives for an order the expiry
 * cron already cancelled (CANCELLED + FAILED payment).
 *
 * Idempotent: the first caller to atomically flip CANCELLED -> PROCESSING
 * proceeds; concurrent calls for the same order see count === 0 and return
 * alreadyProcessed.
 *
 * @param paystackData Optional Paystack response data for amount/currency
 *   validation. When omitted (defensive fallback), the stored payment amount
 *   is compared against itself, which always passes.
 */
export async function handleLatePayment(
  orderId: string,
  paystackRef: string,
  paystackData?: { amount: number; currency?: string | null }
): Promise<LatePaymentResult> {
  const prisma = getPrisma()

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: true,
          productVariant: true,
        },
      },
      payment: true,
      user: { select: { id: true, email: true, profile: { select: { firstName: true } } } },
    },
  })

  if (!order || !order.payment) {
    return { fulfilled: false, alreadyProcessed: true, needsAttention: false }
  }

  // Only apply to CANCELLED orders with FAILED payment
  if (order.status !== 'CANCELLED' || order.payment.status !== 'FAILED') {
    return { fulfilled: false, alreadyProcessed: true, needsAttention: false }
  }

  // Marker check: only cron-expired orders (reservationExpiredAt IS NOT NULL)
  // are eligible for revival via reserveStock. Other cancelled orders
  // (manual/vendor cancellations) skip reserveStock and go straight to the
  // refund/needs-attention path.
  const isCronExpired = order.reservationExpiredAt !== null

  // Idempotency: atomic claim - only proceed if still CANCELLED/FAILED
  const claimResult = await prisma.order.updateMany({
    where: {
      id: orderId,
      status: 'CANCELLED',
      paymentStatus: 'FAILED',
    },
    data: { status: 'PROCESSING' },
  })

  if (claimResult.count === 0) {
    return { fulfilled: false, alreadyProcessed: true, needsAttention: false }
  }

  // Amount and currency validation against Paystack's charged amount, before
  // any stock change or fulfillment.
  if (paystackData) {
    const amountCheck = checkPaystackAmount(paystackData, order.payment)
    if (amountCheck.wrongCurrency || amountCheck.underpaid) {
      // Do not fulfill - refund via existing path.
      return handleRefundOrNeedsAttention(order, paystackRef)
    }
    if (amountCheck.overpaid) {
      const superAdmins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { id: true },
      })
      for (const admin of superAdmins) {
        await createNotification(
          admin.id,
          'ORDER_STATUS_UPDATED',
          'Late payment overpaid',
          `Order ${orderId} was overpaid: Paystack charged ${amountCheck.paystackAmountGhs} GHS, expected ${amountCheck.storedAmountGhs} GHS. Reference: ${paystackRef}`,
        ).catch(() => {})
      }
    }
  }

  // Cron-expired orders: try to reserve stock and fulfil the late payment.
  // Manually cancelled orders: skip reserveStock entirely.
  if (isCronExpired) {
    // Build reservation items from order items (IN_STOCK only)
    const reservationItems = order.items
      .filter((item: any) => item.availabilityType === 'IN_STOCK')
      .map((item: any) => ({
        productId: item.productId,
        productVariantId: item.productVariantId || undefined,
        quantity: item.quantity,
        availabilityType: item.availabilityType as 'IN_STOCK' | 'PREORDER' | 'BACKORDER',
      }))

    if (reservationItems.length > 0) {
      const reservation = await reserveStock(orderId, reservationItems)
      if (!reservation.success) {
        // Insufficient stock: try refund or needs-attention
        return handleRefundOrNeedsAttention(order, paystackRef)
      }
    }

    // Stock reserved (or no stock items) - fulfill the late payment
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PROCESSING', paymentStatus: 'PAID' },
    })
  } else {
    // Manually cancelled order: skip reserveStock, go straight to refund.
    // The customer DID pay (Paystack confirmed), but we won't try to hold
    // stock for a manually cancelled order.
    return handleRefundOrNeedsAttention(order, paystackRef)
  }

  await prisma.payment.update({
    where: { id: order.payment.id },
    data: { status: 'PAID', message: 'Late payment confirmed', paystackRef },
  })

  // Clear cart
  if (order.userId) {
    const cart = await prisma.cart.findUnique({ where: { userId: order.userId } })
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
    }
  }

  // Record fulfillment event
  await recordFulfillmentEvent(orderId, 'PAYMENT_CONFIRMED', order.userId ?? orderId, {
    description: 'Late payment confirmed after order expiry.',
  }).catch(() => {})

  // Audit log
  await createAuditLog({
    userId: order.userId ?? orderId,
    userRole: 'SYSTEM',
    action: 'PAYMENT_CONFIRMED',
    entityType: 'ORDER',
    entityId: orderId,
    afterData: { paymentId: order.payment.id, reference: paystackRef, latePayment: true },
  }).catch(() => {})

  // Notify customer
  const customerName = order.user?.profile?.firstName || order.user?.email?.split('@')[0] || 'Customer'
  if (order.user?.email) {
    sendPaymentConfirmationEmail(order.user.email, customerName, orderId, order.payment.amount, order.payment.currency).catch(() => {})
  }

  if (order.userId) {
    await createNotification(order.userId, 'PAYMENT_SUCCESSFUL', 'Payment Successful', `Your late payment for order #${orderId.slice(0, 8)} has been confirmed.`).catch(() => {})
  }

  logInfo('Late payment fulfilled', { orderId, paystackRef })

  return { fulfilled: true, alreadyProcessed: false, needsAttention: false }
}

/**
 * Insufficient stock for a late-paid order. The customer DID pay (Paystack
 * confirmed), but we cannot fulfill. Try a full refund via the existing
 * createRefund code; if it cannot be started, fall back to needs-attention
 * (notify admins and customer).
 */
async function handleRefundOrNeedsAttention(order: any, paystackRef: string): Promise<LatePaymentResult> {
  const prisma = getPrisma()

  try {
    // createRefund requires paymentStatus === 'PAID'. The customer did pay,
    // so mark the payment/order as PAID first, then refund.
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        status: 'PAID',
        message: 'Late payment confirmed - refunding due to insufficient stock',
        paystackRef,
      },
    })

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'PAID' },
    })

    const result = await createRefund({
      orderId: order.id,
      source: 'CUSTOMER_CANCEL',
      reference: paystackRef,
      actor: {
        triggeredByUserId: order.userId,
        triggeredByRole: 'SYSTEM',
      },
    })

    // createRefund may settle the order to REFUNDED via settleOrderIfFullyRefunded.
    // If it didn't fully refund (e.g. needs-attention rows), flag for review.
    return { fulfilled: false, alreadyProcessed: false, needsAttention: !result.orderRefunded }
  } catch (err) {
    // Refund cannot be started - revert the claim and escalate
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED' },
    }).catch(() => {})

    // Notify super admins
    try {
      const superAdmins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { id: true },
      })
      for (const admin of superAdmins) {
        await createNotification(
          admin.id,
          'ORDER_STATUS_UPDATED',
          'Late payment needs manual review',
          `Order ${order.id} had a confirmed late payment but stock was insufficient and the refund could not be started automatically.`,
        ).catch(() => {})
      }
    } catch {
      // best effort
    }

    // Notify customer
    if (order.userId && order.user?.email) {
      await createNotification(order.userId, 'PAYMENT_FAILED', 'Payment Issue', `Your payment for order #${order.id.slice(0, 8)} was confirmed but we cannot fulfil it. Our team will contact you about a refund.`).catch(() => {})
    }

    logError('Late payment refund could not be started', err instanceof Error ? err : new Error(String(err)), { orderId: order.id })

    return { fulfilled: false, alreadyProcessed: false, needsAttention: true }
  }
}
