import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { createAuditLog } from '@/lib/audit-log'
import { releaseStock } from '@/lib/stock-reservation'
import { createNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

const VALID_CANCEL_STATUSES = ['PENDING', 'PROCESSING']
const VALID_PAYMENT_STATUSES_FOR_REFUND = ['PAID']

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden - Customer access required' }, { status: 403 })
    }

    const orderId = params.orderId
    const body = await request.json()
    const { reason, requestRefund } = body

    const existingOrder = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        userId: payload.userId,
        deletedAt: null,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
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
        payment: true,
      },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found or access denied' }, { status: 404 })
    }

    if (!VALID_CANCEL_STATUSES.includes(existingOrder.status)) {
      return NextResponse.json(
        { error: `Cannot cancel order with status: ${existingOrder.status}. Only orders pending or processing can be cancelled.` },
        { status: 400 }
      )
    }

    if (!['PENDING', 'PROCESSING'].includes(existingOrder.fulfillmentStatus) && existingOrder.orderType !== 'NORMAL') {
      if (existingOrder.fulfillmentStatus && existingOrder.fulfillmentStatus !== 'PENDING' && existingOrder.fulfillmentStatus !== 'AWAITING_STOCK' && existingOrder.fulfillmentStatus !== 'AWAITING_RESTOCK') {
        return NextResponse.json(
          { error: 'This order cannot be cancelled at its current fulfillment stage.' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {
      status: 'CANCELLED',
      fulfillmentStatus: 'CANCELLED',
    }

    const shouldProcessRefund = requestRefund && existingOrder.paymentStatus === 'PAID'
    if (shouldProcessRefund) {
      updateData.paymentStatus = 'REFUNDED'
    }

    const updatedOrder = await getPrisma().order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              select: {
                store: {
                  select: {
                    userId: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    recordFulfillmentEvent(orderId, 'CANCELLED', payload.userId, {
      description: reason || 'Order cancelled by customer',
    }).catch(err => console.error('Failed to record cancellation event:', err))

    createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'ORDER_CANCELLED',
      entityType: 'ORDER',
      entityId: orderId,
      beforeData: { status: existingOrder.status, fulfillmentStatus: existingOrder.fulfillmentStatus, paymentStatus: existingOrder.paymentStatus },
      afterData: { status: 'CANCELLED', fulfillmentStatus: 'CANCELLED', paymentStatus: shouldProcessRefund ? 'REFUNDED' : existingOrder.paymentStatus, reason },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    }).catch(err => console.error('Failed to create audit log:', err))

    if (existingOrder.orderType === 'NORMAL') {
      releaseStock(orderId, payload.userId).catch(err => {
        console.error('Failed to release stock:', err)
      })
    }

    const vendorIds = Array.from(new Set(updatedOrder.items.map(item => item.product.store.userId).filter(Boolean)))
    for (const vendorId of vendorIds) {
      createNotification(
        vendorId,
        'ORDER_STATUS_UPDATED',
        'Order Cancelled by Customer',
        `Customer has cancelled order #${orderId.slice(-8).toUpperCase()}.${shouldProcessRefund ? ' Refund requested.' : ''}`
      ).catch(err => console.error('Failed to notify vendor:', err))
    }

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        fulfillmentStatus: updatedOrder.fulfillmentStatus,
        paymentStatus: updatedOrder.paymentStatus,
        vendorRejected: true,
      },
      refundRequested: shouldProcessRefund,
    })
  } catch (error) {
    console.error('Error cancelling order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}