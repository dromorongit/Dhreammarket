import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string; itemId: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = outcome

    // Only customers can confirm delivery
    if (payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orderId = params.orderId
    const itemId = params.itemId

    // Verify order belongs to the caller
    const order = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        deletedAt: null,
        paymentStatus: 'PAID',
        status: { notIn: ['CANCELLED'] },
      },
      select: { id: true, userId: true, status: true, paymentStatus: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Ownership check: only the order's own customer may confirm its items
    if (order.userId !== payload.userId) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Verify item belongs to this order and has deliveredAt
    const item = await getPrisma().orderItem.findFirst({
      where: {
        id: itemId,
        orderId,
        deliveredAt: { not: null },
      },
      select: { id: true, deliveredAt: true, deliveryConfirmedAt: true },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found or not delivered' }, { status: 404 })
    }

    // If already confirmed, return existing confirmation (idempotent)
    if (item.deliveryConfirmedAt) {
      return NextResponse.json({
        success: true,
        item: {
          id: item.id,
          deliveryConfirmedAt: item.deliveryConfirmedAt,
          deliveryConfirmedBy: 'CUSTOMER',
        },
        alreadyConfirmed: true,
      })
    }

    const now = new Date()

    // Conditional update: only set if deliveryConfirmedAt is still null
    const updated = await getPrisma().orderItem.updateMany({
      where: {
        id: itemId,
        orderId,
        deliveryConfirmedAt: null,
      },
      data: {
        deliveryConfirmedAt: now,
        deliveryConfirmedBy: 'CUSTOMER',
      },
    })

    if (updated.count === 0) {
      // Another request already confirmed it
      const refreshed = await getPrisma().orderItem.findUnique({
        where: { id: itemId },
        select: { deliveryConfirmedAt: true },
      })
      return NextResponse.json({
        success: true,
        item: {
          id: itemId,
          deliveryConfirmedAt: refreshed?.deliveryConfirmedAt,
          deliveryConfirmedBy: 'CUSTOMER',
        },
        alreadyConfirmed: true,
      })
    }

    // Audit log
    await createAuditLog({
      userId: payload.userId,
      userRole: 'CUSTOMER',
      action: 'DELIVERY_CONFIRMED',
      entityType: 'ORDER_ITEM',
      entityId: itemId,
      afterData: {
        orderId,
        deliveryConfirmedAt: now.toISOString(),
        deliveryConfirmedBy: 'CUSTOMER',
      },
    }).catch(err => console.error('Failed to create delivery confirmation audit log:', err))

    return NextResponse.json({
      success: true,
      item: {
        id: itemId,
        deliveryConfirmedAt: now,
        deliveryConfirmedBy: 'CUSTOMER',
      },
      alreadyConfirmed: false,
    })
  } catch (error) {
    console.error('Error confirming delivery:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}