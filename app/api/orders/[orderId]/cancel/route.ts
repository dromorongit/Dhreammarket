import { NextRequest, NextResponse } from 'next/server'
import type { OrderFulfillmentStatus, OrderStatus } from '@prisma/client'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { createAuditLog } from '@/lib/audit-log'
import { releaseStock } from '@/lib/stock-reservation'
import { restoreManualSaleStock } from '@/lib/stock-reservation'
import { createNotification } from '@/lib/notifications'
import { reverseInfluencerOrderCashback } from '@/lib/influencer/order-cashback'
import { notifySuperAdminsRefundRequested } from '@/lib/refunds/admin-notify'
import { isManualOrder } from '@/lib/order-source'
import { invalidateSalesSummaryCaches } from '@/lib/sales-summary-cache'
import { isCancellationPolicyEnabled } from '@/lib/feature-flags'
import {
  CANCELLATION_FEE_GHS,
  FREE_WINDOW_MINUTES,
  BLOCK_THRESHOLD,
  BLOCK_WINDOW_DAYS,
  BLOCK_MONTHS,
  toPesewas,
  pesewasToGhs,
  isBlocked,
  isWithinFreeWindow,
  computeCancellationQuote,
} from '@/lib/cancellation-policy'

export const dynamic = 'force-dynamic'

// Only an order that has not moved past payment/processing may be cancelled.
const VALID_CANCEL_STATUSES: OrderStatus[] = ['PENDING', 'PROCESSING']
// Terminal statuses that can never be cancelled from this route.
const TERMINAL_CANCEL_STATUSES: OrderStatus[] = ['SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED']
// A non-NORMAL order may additionally only be cancelled while it is still
// waiting on stock or fulfillment. NORMAL orders skip this check entirely
// (unchanged, report-only: see audit note on the NORMAL bypass).
const CANCELLABLE_FULFILLMENT_STATUSES: OrderFulfillmentStatus[] = [
  'PENDING',
  'PROCESSING',
  'AWAITING_STOCK',
  'AWAITING_RESTOCK',
]

/**
 * A non-NORMAL order is cancellable while it has no fulfillment status yet or
 * while it is still in one of the waiting/processing stages. NORMAL orders are
 * always cancellable from this stage guard's point of view.
 */
function isFulfillmentStageCancellable(order: {
  orderType: string
  fulfillmentStatus: string | null
}): boolean {
  if (order.orderType === 'NORMAL') {
    return true
  }
  if (!order.fulfillmentStatus) {
    return true
  }
  return (CANCELLABLE_FULFILLMENT_STATUSES as readonly string[]).includes(
    order.fulfillmentStatus
  )
}

/** Thrown from inside the transaction to produce a specific HTTP response. */
class CancelRejectedError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'CancelRejectedError'
    this.status = status
  }
}

const ORDER_SELECT = {
  id: true,
  status: true,
  paymentStatus: true,
  total: true,
  subtotal: true,
  shipping: true,
  tax: true,
  userId: true,
  createdAt: true,
  paymentConfirmedAt: true,
  source: true,
  orderType: true,
  fulfillmentStatus: true,
  walletAmountApplied: true,
  payment: {
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      reference: true,
      paystackRef: true,
      message: true,
      createdAt: true,
    },
  },
  items: {
    select: {
      id: true,
      productId: true,
      productVariantId: true,
      quantity: true,
      price: true,
      shippedAt: true,
      product: {
        select: {
          store: {
            select: {
              id: true,
              userId: true,
              name: true,
            },
          },
        },
      },
    },
  },
} as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const payload = outcome

    if (payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orderId = params.orderId
    const body = await request.json()
    // requestRefund is still accepted in the body for backward compatibility
    // but no longer controls anything: every paid cancellation creates a
    // refund request automatically.
    const { reason } = body

    const existingOrder = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        userId: payload.userId,
        deletedAt: null,
      },
      select: ORDER_SELECT,
    })

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found or access denied' },
        { status: 404 }
      )
    }

    if (!VALID_CANCEL_STATUSES.includes(existingOrder.status)) {
      return NextResponse.json(
        { error: `Cannot cancel order with status: ${existingOrder.status}. Only orders pending or processing can be cancelled.` },
        { status: 400 }
      )
    }

    if (!isFulfillmentStageCancellable(existingOrder)) {
      return NextResponse.json(
        { error: 'This order cannot be cancelled at its current fulfillment stage.' },
        { status: 400 }
      )
    }

    // One transaction: lock the order row and the user row, then decide and
    // commit the cancellation. Serialises concurrent cancels and the block
    // check so a user cannot race past the 30-day count threshold.
    const outcomeResult = await getPrisma().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${payload.userId} FOR UPDATE`

      // Re-read the locked order row so every decision below is consistent.
      const order = await tx.order.findFirst({
        where: { id: orderId, userId: payload.userId, deletedAt: null },
        select: ORDER_SELECT,
      })

      if (!order) {
        throw new CancelRejectedError(404, 'Order not found or access denied')
      }

      if (!VALID_CANCEL_STATUSES.includes(order.status)) {
        throw new CancelRejectedError(
          400,
          `Cannot cancel order with status: ${order.status}. Only orders pending or processing can be cancelled.`
        )
      }

      if (!isFulfillmentStageCancellable(order)) {
        throw new CancelRejectedError(400, 'This order cannot be cancelled at its current fulfillment stage.')
      }

      if (order.items.some((item) => item.shippedAt)) {
        throw new CancelRejectedError(400, 'This order cannot be cancelled: an item has already shipped.')
      }

      const manual = isManualOrder(order)
      const paid = order.paymentStatus === 'PAID'

      // Manual orders and unpaid orders cancel exactly as today: no fee, no
      // cancellation counter row, no block check.
      if (manual || !paid) {
        const result = await tx.order.updateMany({
          where: {
            id: orderId,
            userId: payload.userId,
            deletedAt: null,
            status: { in: VALID_CANCEL_STATUSES },
            ...(order.orderType !== 'NORMAL'
              ? { fulfillmentStatus: { in: CANCELLABLE_FULFILLMENT_STATUSES } }
              : {}),
          },
          data: {
            status: 'CANCELLED',
            fulfillmentStatus: 'CANCELLED',
          },
        })
        return {
          count: result.count,
          order,
          manual,
          unpaid: !paid,
          skipPolicy: true,
          policyActive: false,
          free: false,
          feeAmount: 0,
          refundAmount: order.total,
        }
      }

      // Paid non-manual order. The policy applies only when the flag is on,
      // PlatformPolicy.systemCutoverTimestamp is set, and the order was
      // created at or after the cutover. Otherwise today's exact behaviour.
      const policy = await tx.platformPolicy.findUnique({
        where: { id: 'singleton' },
        select: { systemCutoverTimestamp: true },
      })
      const cutover = policy?.systemCutoverTimestamp

      const policyActive =
        isCancellationPolicyEnabled() &&
        Boolean(cutover) &&
        order.createdAt.getTime() >= new Date(cutover as Date).getTime()

      const now = new Date()

      if (policyActive) {
        const user = await tx.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, cancellationBlockedUntil: true },
        })

        if (isBlocked(user?.cancellationBlockedUntil ?? null, now)) {
          const blockedUntil = user!.cancellationBlockedUntil!
          throw new CancelRejectedError(
            403,
            `Cancellations are blocked until ${blockedUntil.toISOString()}. You have cancelled too many orders in the last 30 days.`
          )
        }
      }

      // Atomic conditional update: the where clause re-checks ownership and
      // every guard that decided this order is cancellable, so only one of
      // two rapid cancels can win. A count of 0 means the order was already
      // cancelled or moved on between the read above and this update, and its
      // side effects below must not run a second time.
      const result = await tx.order.updateMany({
        where: {
          id: orderId,
          userId: payload.userId,
          deletedAt: null,
          status: { in: VALID_CANCEL_STATUSES },
          ...(order.orderType !== 'NORMAL'
            ? { fulfillmentStatus: { in: CANCELLABLE_FULFILLMENT_STATUSES } }
            : {}),
        },
        data: {
          status: 'CANCELLED',
          fulfillmentStatus: 'CANCELLED',
        },
      })

      if (result.count === 0) {
        throw new CancelRejectedError(400, 'This order cannot be cancelled at its current fulfillment stage.')
      }

      let feeAmount = 0
      let refundAmount = order.total
      let free = false

      if (policyActive) {
        const quote = computeCancellationQuote({
          order,
          payment: order.payment,
          now,
          policyActive: true,
        })
        free = quote.free
        feeAmount = quote.feeAmount
        refundAmount = quote.refundAmount

        // Every paid non-manual cancellation counts, including free ones.
        await tx.customerCancellation.create({
          data: {
            userId: payload.userId,
            orderId: order.id,
            feeAmount: feeAmount,
            refundAmount: refundAmount,
          },
        })

        // 30-day block count: if this is the 4th (or later) cancellation in the
        // window, block the user for 3 months from the 4th row's createdAt.
        // The 4th cancellation itself succeeds; the block applies from the next
        // attempt.
        const thirtyDaysAgo = new Date(now.getTime() - BLOCK_WINDOW_DAYS * 24 * 60 * 60 * 1000)
        const cancellations = await tx.customerCancellation.findMany({
          where: {
            userId: payload.userId,
            createdAt: { gte: thirtyDaysAgo },
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true, createdAt: true },
        })

        if (cancellations.length >= BLOCK_THRESHOLD) {
          const fourth = cancellations[BLOCK_THRESHOLD - 1]
          const blockedUntil = new Date(fourth.createdAt.getTime())
          blockedUntil.setUTCMonth(blockedUntil.getUTCMonth() + BLOCK_MONTHS)
          await tx.user.update({
            where: { id: payload.userId },
            data: { cancellationBlockedUntil: blockedUntil },
          })
        }
      }

      return {
        count: result.count,
        order,
        manual: false,
        unpaid: false,
        skipPolicy: false,
        policyActive,
        free,
        feeAmount,
        refundAmount,
      }
    })

    if (outcomeResult instanceof CancelRejectedError) {
      return NextResponse.json({ error: outcomeResult.message }, { status: outcomeResult.status })
    }

    const { count, order, manual } = outcomeResult

    if (count === 0) {
      // Re-read so the error reports the order's real current status rather
      // than the possibly stale one from above.
      const current = await getPrisma().order.findFirst({
        where: { id: orderId, userId: payload.userId, deletedAt: null },
        select: { status: true },
      })

      if (!current) {
        return NextResponse.json(
          { error: 'Order not found or access denied' },
          { status: 404 }
        )
      }

      if (!VALID_CANCEL_STATUSES.includes(current.status)) {
        return NextResponse.json(
          { error: `Cannot cancel order with status: ${current.status}. Only orders pending or processing can be cancelled.` },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'This order cannot be cancelled at its current fulfillment stage.' },
        { status: 400 }
      )
    }

    // Manual cancellation is atomic: restore consumed stock via the manual-sale
    // path. releaseStock is never called for manual orders.
    if (manual) {
      await getPrisma().$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`
        const restoreResult = await restoreManualSaleStock(tx, orderId)
        if (!restoreResult.success) {
          throw new Error(restoreResult.error || 'Failed to restore stock')
        }
      })
    }

    // From here on the cancellation is committed, so side effects run exactly
    // once. A paid order keeps paymentStatus PAID: every paid cancellation
    // creates a refund request for admin approval, and money only ever moves
    // through POST /api/admin/refunds -> createRefund (SUPER_ADMIN), never
    // from here.
    const refundRequested = order.paymentStatus === 'PAID' && !manual

    try {
      await reverseInfluencerOrderCashback(orderId)
    } catch (reverseErr) {
      console.error(
        `Failed to reverse influencer cashback on cancelled order ${orderId}:`,
        reverseErr instanceof Error ? reverseErr.message : reverseErr
      )
    }

    recordFulfillmentEvent(orderId, 'CANCELLED', payload.userId, {
      description: reason || 'Order cancelled by customer',
    }).catch(err => console.error('Failed to record cancellation event:', err))

    createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'ORDER_CANCELLED',
      entityType: 'ORDER',
      entityId: orderId,
      beforeData: {
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        paymentStatus: order.paymentStatus,
      },
      afterData: {
        status: 'CANCELLED',
        fulfillmentStatus: 'CANCELLED',
        paymentStatus: order.paymentStatus,
        refundRequested,
        reason,
      },
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        null,
    }).catch(err => console.error('Failed to create cancellation audit log:', err))

    if (order.orderType === 'NORMAL' && !manual) {
      try {
        const release = await releaseStock(orderId, payload.userId)
        if (!release.success) {
          throw new Error(release.error || 'Stock release failed')
        }
      } catch (stockErr) {
        // The cancellation itself stands; flag it for follow-up instead.
        console.error(
          `Failed to release stock for cancelled order ${orderId}:`,
          stockErr instanceof Error ? stockErr.message : stockErr
        )
        await createAuditLog({
          userId: payload.userId,
          userRole: payload.role,
          action: 'ORDER_CANCELLED',
          entityType: 'ORDER',
          entityId: orderId,
          afterData: {
            status: 'CANCELLED',
            stockReleaseFailed: true,
          },
        }).catch(err => console.error('Failed to create stock release audit log:', err))
      }
    }

    if (refundRequested) {
      // Pending-approval refund request. No Refund row and no Paystack call:
      // a Refund row would consume the item's refundable cap and block the
      // super admin's approval, and no RefundStatus value means "requested".
      // The SUPER_ADMIN approves by issuing the real refund from the admin
      // panel (POST /api/admin/refunds -> createRefund).
      const policyData = (outcomeResult as { policyActive?: boolean; free?: boolean; feeAmount?: number; refundAmount?: number })
      const eventData: Record<string, unknown> = {
        refundAmount: policyData.refundAmount,
        feeAmount: policyData.feeAmount,
        note: 'Paystack processing fee is not refunded',
      }
      recordFulfillmentEvent(orderId, 'REFUND_REQUESTED', payload.userId, eventData).catch(
        err => console.error('Failed to record refund request event:', err)
      )
      createAuditLog({
        userId: payload.userId,
        userRole: payload.role,
        action: 'ORDER_REFUND_REQUESTED',
        entityType: 'ORDER',
        entityId: orderId,
        afterData: {
          source: 'CUSTOMER_CANCEL',
          paymentStatus: order.paymentStatus,
          total: order.total,
          walletAssisted: (order.walletAmountApplied ?? 0) > 0,
          reason,
          feeAmount: policyData.feeAmount,
          refundAmount: policyData.refundAmount,
        },
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0] ||
          request.headers.get('x-real-ip') ||
          null,
      }).catch(err => console.error('Failed to create refund request audit log:', err))

      // Tell the super admins a request is waiting. Best-effort: a failure
      // here must never undo or block the cancellation above, which is
      // already committed.
      const storeNames = Array.from(
        new Set(
          order.items
            .map((item) => item?.product?.store?.name)
            .filter((name): name is string => Boolean(name))
        )
      )
      notifySuperAdminsRefundRequested({
        orderId,
        total: order.total,
        storeName: storeNames.length === 1 ? storeNames[0] : null,
        source: 'CUSTOMER_CANCEL',
      }).catch(err =>
        console.error('Failed to notify super admins about the refund request:', err)
      )
    }

    // Notify vendors (existing behaviour, unchanged).
    const vendorIds = Array.from(
      new Set(
        order.items
          .map(item => item.product.store.userId)
          .filter(Boolean)
      )
    )

    for (const vendorId of vendorIds) {
      createNotification(
        vendorId,
        'ORDER_STATUS_UPDATED',
        'Order Cancelled by Customer',
        `An order has been cancelled by the customer${refundRequested ? ' with a refund request that is pending review' : ''}.`
      ).catch(err =>
        console.error('Failed to create vendor cancellation notification:', err)
      )
    }

    // A cancelled order leaves the totals, so the money view of every store
    // that sold into it has to be recomputed.
    invalidateSalesSummaryCaches(
      order.items
        .map(item => item.product?.store?.id)
        .filter((storeId): storeId is string => Boolean(storeId))
    )

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        status: 'CANCELLED',
        fulfillmentStatus: 'CANCELLED',
        paymentStatus: order.paymentStatus,
        vendorRejected: true, // response-only flag, see README - never persisted
      },
      refundRequested,
      ...(outcomeResult.policyActive
        ? {
            policyActive: outcomeResult.policyActive,
            free: outcomeResult.free,
            feeAmount: outcomeResult.feeAmount,
            refundAmount: outcomeResult.refundAmount,
          }
        : {}),
    })
  } catch (error) {
    if (error instanceof CancelRejectedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error cancelling order:', error)
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 }
    )
  }
}
