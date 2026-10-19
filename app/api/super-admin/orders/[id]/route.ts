import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'
import { isManualOrder } from '@/lib/order-source'
import { restoreManualSaleStock } from '@/lib/stock-reservation'

const prisma = getPrisma()

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const actor = authCheck
    const orderId = params.id
    const orderIdPrefix = orderId.slice(0, 8)

    const auditRefusal = async (reason: string) => {
      try {
        await createAuditLog({
          userId: actor.userId,
          userRole: actor.role,
          action: 'ORDER_DELETE_REFUSED',
          entityType: 'ORDER',
          entityId: orderIdPrefix,
          afterData: {
            orderId: orderIdPrefix,
            actorId: actor.userId,
            reason,
          },
        })
      } catch (err) {
        console.error('Failed to write delete-refusal audit log:', err)
      }
    }

    const auditDeleted = async (reason: string) => {
      try {
        await createAuditLog({
          userId: actor.userId,
          userRole: actor.role,
          action: 'ORDER_DELETED',
          entityType: 'ORDER',
          entityId: orderIdPrefix,
          afterData: {
            orderId: orderIdPrefix,
            actorId: actor.userId,
            reason,
          },
        })
      } catch (err) {
        console.error('Failed to write delete audit log:', err)
      }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        refunds: true,
        items: {
          include: {
            returnRequests: true,
            payoutItems: true,
            balanceAdjustments: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const hasRefund = order.refunds.length > 0
    const hasReturnRequest = order.items.some((item) => item.returnRequests.length > 0)
    const hasPayoutItem = order.items.some((item) => item.payoutItems.length > 0)
    const hasBalanceAdjustment = order.items.some((item) => item.balanceAdjustments.length > 0)

    if (order.paymentStatus === 'PAID') {
      await auditRefusal('order payment status is PAID')
      return NextResponse.json({ error: 'Cannot delete an order with payment status PAID' }, { status: 409 })
    }

    if (order.paymentStatus === 'REFUNDED') {
      await auditRefusal('order payment status is REFUNDED')
      return NextResponse.json({ error: 'Cannot delete an order with payment status REFUNDED' }, { status: 409 })
    }

    if (hasRefund) {
      await auditRefusal('order has refund rows')
      return NextResponse.json({ error: 'Cannot delete an order that has refunds' }, { status: 409 })
    }

    if (hasReturnRequest) {
      await auditRefusal('order has return requests')
      return NextResponse.json({ error: 'Cannot delete an order that has return requests' }, { status: 409 })
    }

    if (hasPayoutItem) {
      await auditRefusal('order has payout items')
      return NextResponse.json({ error: 'Cannot delete an order that has payout items' }, { status: 409 })
    }

    if (hasBalanceAdjustment) {
      await auditRefusal('order has balance adjustments')
      return NextResponse.json({ error: 'Cannot delete an order that has balance adjustments' }, { status: 409 })
    }

    await prisma.$transaction(async (tx) => {
      if (isManualOrder(order) && order.inventoryConsumedAt) {
        const restoreResult = await restoreManualSaleStock(tx, orderId)
        if (!restoreResult.success) {
          throw new Error(restoreResult.error || 'Failed to restore stock')
        }
      }
      await tx.payment.deleteMany({ where: { orderId, status: { in: ['PENDING', 'FAILED', 'CANCELLED'] } } })
      await tx.orderItem.deleteMany({ where: { orderId } })
      await tx.productReview.deleteMany({ where: { orderId } })
      await tx.vendorReview.deleteMany({ where: { orderId } })
      await tx.order.delete({ where: { id: orderId } })
    })

    await auditDeleted('order deleted')

    return NextResponse.json({ success: true, message: 'Order permanently deleted' })
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
