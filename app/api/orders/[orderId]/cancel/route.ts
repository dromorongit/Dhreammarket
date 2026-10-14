import { NextRequest, NextResponse } from 'next/server'
import type { OrderFulfillmentStatus, OrderStatus } from '@prisma/client'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { createAuditLog } from '@/lib/audit-log'
import { releaseStock } from '@/lib/stock-reservation'
import { createNotification } from '@/lib/notifications'
import { reverseInfluencerOrderCashback } from '@/lib/influencer/order-cashback'
import { notifySuperAdminsRefundRequested } from '@/lib/refunds/admin-notify'

export const dynamic = 'force-dynamic'

// Only an order that has not moved past payment/processing may be cancelled.
const VALID_CANCEL_STATUSES: OrderStatus[] = ['PENDING', 'PROCESSING']
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
      include: {
        payment: true,
        items: {
          include: {
            product: {
              select: {
                store: {
                  select: {
                    userId: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
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

    // Atomic conditional update: the where clause re-checks ownership and every
    // guard that decided this order is cancellable, so only one of two rapid
    // cancels can win. A count of 0 means the order was already cancelled or
    // moved on between the read above and this update, and its side effects
    // below must not run a second time.
    const cancelledCount = await getPrisma().$transaction(async (tx) => {
      const result = await tx.order.updateMany({
        where: {
          id: orderId,
          userId: payload.userId,
          deletedAt: null,
          status: { in: VALID_CANCEL_STATUSES },
          ...(existingOrder.orderType !== 'NORMAL'
            ? { fulfillmentStatus: { in: CANCELLABLE_FULFILLMENT_STATUSES } }
            : {}),
        },
        data: {
          status: 'CANCELLED',
          fulfillmentStatus: 'CANCELLED',
        },
      })
      return result.count
    })

    if (cancelledCount === 0) {
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

    // From here on the cancellation is committed, so side effects run exactly
    // once. A paid order keeps paymentStatus PAID: every paid cancellation
    // creates a refund request for admin approval, and money only ever moves
    // through POST /api/admin/refunds -> createRefund (SUPER_ADMIN), never
    // from here.
    const refundRequested = existingOrder.paymentStatus === 'PAID'

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
        status: existingOrder.status,
        fulfillmentStatus: existingOrder.fulfillmentStatus,
        paymentStatus: existingOrder.paymentStatus,
      },
      afterData: {
        status: 'CANCELLED',
        fulfillmentStatus: 'CANCELLED',
        paymentStatus: existingOrder.paymentStatus,
        refundRequested,
        reason,
      },
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        null,
    }).catch(err => console.error('Failed to create cancellation audit log:', err))

    if (existingOrder.orderType === 'NORMAL') {
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
      recordFulfillmentEvent(orderId, 'REFUND_REQUESTED', payload.userId).catch(
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
          paymentStatus: existingOrder.paymentStatus,
          total: existingOrder.total,
          walletAssisted: (existingOrder.walletAmountApplied ?? 0) > 0,
          reason,
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
          existingOrder.items
            .map((item) => item?.product?.store?.name)
            .filter((name): name is string => Boolean(name))
        )
      )
      notifySuperAdminsRefundRequested({
        orderId,
        total: existingOrder.total,
        storeName: storeNames.length === 1 ? storeNames[0] : null,
        source: 'CUSTOMER_CANCEL',
      }).catch(err =>
        console.error('Failed to notify super admins about the refund request:', err)
      )
    }

    // Notify vendors (existing behaviour, unchanged). We cannot access updatedOrder
    // after a conditional updateMany, so the already-loaded order is used.
    const vendorIds = Array.from(
      new Set(
        existingOrder.items
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

    return NextResponse.json({
      success: true,
      order: {
        id: existingOrder.id,
        status: 'CANCELLED',
        fulfillmentStatus: 'CANCELLED',
        paymentStatus: existingOrder.paymentStatus,
        vendorRejected: true, // response-only flag, see README - never persisted
      },
      refundRequested,
    })
  } catch (error) {
    console.error('Error cancelling order:', error)
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 }
    )
  }
}
