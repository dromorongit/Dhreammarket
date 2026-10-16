import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const adminUser = authCheck
    const orderId = params.id
    const itemId = params.itemId

    const body = await request.json()
    const { reason } = body

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Reason is required for admin delivery confirmation' },
        { status: 400 }
      )
    }

    // Verify order exists
    const order = await getPrisma().order.findUnique({
      where: { id: orderId, deletedAt: null },
      select: { id: true, status: true, paymentStatus: true },
    })

    if (!order) {
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
          deliveryConfirmedBy: 'ADMIN',
        },
        alreadyConfirmed: true,
      })
    }

    const now = new Date()

    // Conditional update: only set if deliveryConfirmedAt is still null
    const updated = await getPrisma().orderItem.updateMany({
      where: {
        id: itemId,
        deliveryConfirmedAt: null,
      },
      data: {
        deliveryConfirmedAt: now,
        deliveryConfirmedBy: 'ADMIN',
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
          deliveryConfirmedBy: 'ADMIN',
        },
        alreadyConfirmed: true,
      })
    }

    // Audit log with reason
    await createAuditLog({
      userId: adminUser.userId,
      userRole: 'SUPER_ADMIN',
      action: 'DELIVERY_CONFIRMED_ADMIN',
      entityType: 'ORDER_ITEM',
      entityId: itemId,
      afterData: {
        orderId,
        deliveryConfirmedAt: now.toISOString(),
        deliveryConfirmedBy: 'ADMIN',
        reason: reason.trim(),
      },
    }).catch(err => console.error('Failed to create admin delivery confirmation audit log:', err))

    return NextResponse.json({
      success: true,
      item: {
        id: itemId,
        deliveryConfirmedAt: now,
        deliveryConfirmedBy: 'ADMIN',
      },
      alreadyConfirmed: false,
    })
  } catch (error) {
    console.error('Error confirming delivery (admin):', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}