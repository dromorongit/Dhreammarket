import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { createAuditLog } from '@/lib/audit-log'
import { orderDisplayNumber } from '@/lib/manual-orders'
import { fromPesewas, validateDeliveryCost } from '@/lib/sales-summary'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/vendor/manual-orders/[orderId]
 *
 * Body: { deliveryCost }
 *
 * `deliveryCost` is what the vendor actually paid the rider. It is NOT the
 * delivery fee charged to the customer (that is `Order.shipping`), and it is
 * only ever set on a MANUAL order: an online order is delivered by the
 * platform, not by the vendor.
 */
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
        { error: 'Complete store setup to update manual orders' },
        { status: 403 }
      )
    }

    const orderId = params.orderId

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const deliveryCostResult = validateDeliveryCost(body.deliveryCost)
    if ('error' in deliveryCostResult) {
      return NextResponse.json({ error: deliveryCostResult.error }, { status: 400 })
    }
    if (!deliveryCostResult.provided) {
      return NextResponse.json({ error: 'deliveryCost is required' }, { status: 400 })
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
        paymentStatus: true,
        deliveryCost: true,
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

    const deliveryCost = fromPesewas(deliveryCostResult.pesewas)

    const updatedOrder = await getPrisma().order.update({
      where: { id: orderId },
      data: { deliveryCost },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        deliveryCost: true,
        total: true,
      },
    })

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'MANUAL_ORDER_DELIVERY_COST_UPDATED',
      entityType: 'ORDER',
      entityId: orderId,
      beforeData: { deliveryCost: existingOrder.deliveryCost },
      afterData: { deliveryCost },
    }).catch((err) => console.error('Failed to create delivery cost audit log:', err))

    return NextResponse.json({
      order: {
        id: updatedOrder.id,
        displayNumber: orderDisplayNumber(updatedOrder.id),
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        deliveryCost: updatedOrder.deliveryCost,
        total: updatedOrder.total,
      },
    })
  } catch (error) {
    console.error('Error updating manual order delivery cost:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    )
  }
}
