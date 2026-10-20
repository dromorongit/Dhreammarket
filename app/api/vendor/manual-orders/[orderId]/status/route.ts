import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { restoreManualSaleStock } from '@/lib/stock-reservation'
import { stampOrderItems } from '@/lib/order-delivery-stamps'
import { createAuditLog } from '@/lib/audit-log'
import { orderDisplayNumber } from '@/lib/manual-orders'
import { invalidateSalesSummaryCache } from '@/lib/sales-summary-cache'
import type { OrderFulfillmentStatus, OrderStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

// Manual order fulfillment graph: PROCESSING -> SHIPPED -> DELIVERED -> COMPLETED,
// plus CANCELLED from PROCESSING or SHIPPED. Payment status never gates a transition.
const MANUAL_STATUS_TRANSITIONS: Record<string, string[]> = {
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  PENDING: [],
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup to update manual order status' },
        { status: 403 }
      )
    }

    const orderId = params.orderId

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { status } = body
    if (typeof status !== 'string' || status.length === 0) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const existingOrder = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        items: {
          some: {
            product: {
              storeId: store.id,
            },
          },
        },
      },
      select: {
        id: true,
        source: true,
        status: true,
        fulfillmentStatus: true,
        paymentStatus: true,
        receiptToken: true,
        inventoryConsumedAt: true,
        total: true,
      },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Manual order not found or access denied' },
        { status: 404 }
      )
    }

    if (existingOrder.source !== 'MANUAL') {
      return NextResponse.json(
        { error: 'Only manual orders can be updated through this endpoint' },
        { status: 409 }
      )
    }

    const allowedNext = MANUAL_STATUS_TRANSITIONS[existingOrder.status]
    if (!allowedNext || !allowedNext.includes(status)) {
      if (status === 'CANCELLED' && ['DELIVERED', 'COMPLETED'].includes(existingOrder.status)) {
        return NextResponse.json(
          { error: 'Cannot cancel a delivered or completed order — a returns flow is required' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        {
          error: `Cannot move from ${existingOrder.status} to ${status} — allowed next steps: ${allowedNext?.join(', ') || 'none'}`,
        },
        { status: 400 }
      )
    }

    const prisma = getPrisma()
    const now = new Date()
    const storeId = store.id

    if (status === 'CANCELLED') {
      // Atomic cancel: lock the order row, restore stock exactly once
      // (restoreManualSaleStock is idempotent via inventoryConsumedAt), then cancel.
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`
          const restoreResult = await restoreManualSaleStock(tx, orderId)
          if (!restoreResult.success) {
            throw new Error(restoreResult.error || 'Failed to restore stock')
          }
          await tx.order.update({
            where: { id: orderId },
            data: { status: 'CANCELLED', fulfillmentStatus: 'CANCELLED' },
          })
        })
      } catch (err) {
        return NextResponse.json(
          { error: `Failed to cancel manual order: ${err instanceof Error ? err.message : 'Unknown error'}` },
          { status: 500 }
        )
      }

      await createAuditLog({
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
        },
      }).catch((err) => console.error('Failed to create cancellation audit log:', err))

      // A cancelled sale leaves the totals, so the cached summaries of this
      // store are dropped.
      invalidateSalesSummaryCache(store.id)

      return NextResponse.json({
        order: {
          id: existingOrder.id,
          displayNumber: orderDisplayNumber(existingOrder.id),
          status: 'CANCELLED',
          fulfillmentStatus: 'CANCELLED',
          paymentStatus: existingOrder.paymentStatus,
        },
      })
    }

    const newFulfillmentStatus = status === 'COMPLETED' ? existingOrder.fulfillmentStatus : status

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: status as OrderStatus,
          fulfillmentStatus: newFulfillmentStatus as OrderFulfillmentStatus,
        },
      })

      if (status === 'SHIPPED') {
        await stampOrderItems({ orderId, storeId, field: 'shippedAt', now, tx })
      }
      if (status === 'DELIVERED') {
        await stampOrderItems({ orderId, storeId, field: 'deliveredAt', now, tx })
      }

      return updated
    })

    // The status of the sale changed, so the cached summaries of this store
    // are dropped.
    invalidateSalesSummaryCache(store.id)

    return NextResponse.json({
      order: {
        id: updatedOrder.id,
        displayNumber: orderDisplayNumber(updatedOrder.id),
        status: updatedOrder.status,
        fulfillmentStatus: updatedOrder.fulfillmentStatus,
        paymentStatus: existingOrder.paymentStatus,
      },
    })
  } catch (error) {
    console.error('Error updating manual order status:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    )
  }
}
