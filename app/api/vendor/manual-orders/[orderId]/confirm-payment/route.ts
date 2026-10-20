import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { createAuditLog } from '@/lib/audit-log'
import { orderDisplayNumber } from '@/lib/manual-orders'
import { invalidateSalesSummaryCache } from '@/lib/sales-summary-cache'

export const dynamic = 'force-dynamic'

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
        { error: 'Complete store setup to confirm payments' },
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

    const { paymentMethod } = body
    if (typeof paymentMethod !== 'string' || paymentMethod.trim().length === 0) {
      return NextResponse.json({ error: 'paymentMethod is required' }, { status: 400 })
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
        paymentMethod: true,
        paymentConfirmedAt: true,
        receiptToken: true,
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
        { error: 'Only manual orders can be confirmed through this endpoint' },
        { status: 409 }
      )
    }

    if (existingOrder.paymentStatus === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot confirm a cancelled order' },
        { status: 409 }
      )
    }

    if (existingOrder.paymentStatus === 'PAID') {
      // Idempotent: already confirmed, no changes.
      return NextResponse.json({
        order: {
          id: existingOrder.id,
          displayNumber: orderDisplayNumber(existingOrder.id),
          receiptToken: existingOrder.receiptToken,
          status: existingOrder.status,
          paymentStatus: existingOrder.paymentStatus,
          paymentMethod: existingOrder.paymentMethod,
          paymentConfirmedAt: existingOrder.paymentConfirmedAt,
          total: existingOrder.total,
        },
      })
    }

    if (existingOrder.paymentStatus !== 'PENDING') {
      return NextResponse.json(
        { error: `Only pending manual orders can be confirmed (current: ${existingOrder.paymentStatus})` },
        { status: 400 }
      )
    }

    const prisma = getPrisma()
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          paymentMethod: paymentMethod.trim(),
          paymentConfirmedAt: now,
        },
      })

      await createAuditLog({
        userId: payload.userId,
        userRole: payload.role,
        action: 'PAYMENT_CONFIRMED',
        entityType: 'ORDER',
        entityId: orderId,
        afterData: {
          source: 'MANUAL',
          paymentStatus: 'PAID',
          paymentMethod: paymentMethod.trim(),
          paymentConfirmedAt: now,
        },
      }).catch((err) => console.error('Failed to create payment confirmation audit log:', err))
    })

    // The sale moves from "unpaid" to "paid": it leaves the receivables and
    // joins the revenue, so the cached summaries of this store are dropped.
    invalidateSalesSummaryCache(store.id)

    return NextResponse.json({
      order: {
        id: existingOrder.id,
        displayNumber: orderDisplayNumber(existingOrder.id),
        receiptToken: existingOrder.receiptToken,
        status: existingOrder.status,
        paymentStatus: 'PAID',
        paymentMethod: paymentMethod.trim(),
        paymentConfirmedAt: now,
        total: existingOrder.total,
      },
    })
  } catch (error) {
    console.error('Error confirming manual order payment:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    )
  }
}
