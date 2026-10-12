import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { rateLimit } from '@/lib/rate-limit'
import { getPrisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

/**
 * Refund rows in these states mean money is already moving or has moved, so
 * the order is not waiting for a decision anymore and must stay out of the
 * queue. FAILED and NEEDS_ATTENTION rows do not block: the order stays in the
 * queue with that state visible.
 */
const ACTIVE_REFUND_STATUSES = ['PENDING', 'PROCESSING', 'PROCESSED'] as const

export type RefundRequestSource =
  | 'CUSTOMER_CANCEL'
  | 'VENDOR_REJECTION'
  | 'NONE_RECORDED'

type RefundRequestItem = {
  orderId: string
  orderRef: string
  cancelledAt: string
  requestSource: RefundRequestSource
  total: number
  currency: string | null
  walletAssisted: boolean
  orderType: string
  storeName: string | null
  ageDays: number
  refundStatus: string | null
}

/**
 * GET /api/admin/refund-requests
 *
 * Queue of cancelled paid orders whose refund still needs a decision.
 *
 * Rule: status = CANCELLED, paymentStatus = PAID, deletedAt = null, and no
 * Refund row in PENDING, PROCESSING or PROCESSED. A fully refunded order is
 * flipped to paymentStatus REFUNDED by settleOrderIfFullyRefunded, so PAID
 * here also means "not fully refunded". Orders whose only Refund rows are
 * FAILED or NEEDS_ATTENTION remain in the queue with refundStatus visible.
 *
 * Sorted oldest cancellation first. updatedAt is bumped by the cancellation
 * update itself, so for a cancelled order it is the cancellation time.
 *
 * Response carries no customer email, phone, address or payment reference.
 * Restricted to SUPER_ADMIN, the same guard as /api/admin/refunds.
 */
export async function GET(request: NextRequest) {
  const rateLimitCheck = rateLimit('admin-orders')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const superAdmin = await requireSuperAdmin()
    if (superAdmin instanceof NextResponse) {
      return superAdmin
    }

    const { searchParams } = new URL(request.url)

    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')

    let page = 1
    if (pageParam !== null) {
      const parsed = Number.parseInt(pageParam, 10)
      if (!Number.isFinite(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: 'page must be a positive integer' },
          { status: 400 }
        )
      }
      page = parsed
    }

    let limit = DEFAULT_PAGE_SIZE
    if (limitParam !== null) {
      const parsed = Number.parseInt(limitParam, 10)
      if (!Number.isFinite(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: 'limit must be a positive integer' },
          { status: 400 }
        )
      }
      limit = Math.min(parsed, MAX_PAGE_SIZE)
    }

    const prisma = getPrisma()

    const orders = await prisma.order.findMany({
      where: {
        status: 'CANCELLED',
        paymentStatus: 'PAID',
        deletedAt: null,
        refunds: { none: { status: { in: [...ACTIVE_REFUND_STATUSES] } } },
      },
      include: {
        payment: { select: { currency: true } },
        items: {
          include: {
            product: {
              select: { store: { select: { name: true } } },
            },
          },
        },
        refunds: {
          select: { status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit + 1,
    })

    const hasMore = orders.length > limit
    const pageOrders = hasMore ? orders.slice(0, limit) : orders

    const orderIds = pageOrders.map((order) => order.id)

    const [cancelEvents, requestLogs] = await Promise.all([
      orderIds.length > 0
        ? prisma.fulfillmentEvent.findMany({
            where: { orderId: { in: orderIds }, eventType: 'CANCELLED' },
            select: { orderId: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      orderIds.length > 0
        ? prisma.auditLog.findMany({
            where: {
              entityType: 'ORDER',
              entityId: { in: orderIds },
              action: 'ORDER_REFUND_REQUESTED',
            },
            select: { entityId: true, afterData: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ])

    // Latest CANCELLED event per order is the cancellation time.
    const cancelledAtByOrder = new Map<string, Date>()
    for (const event of cancelEvents) {
      if (!cancelledAtByOrder.has(event.orderId)) {
        cancelledAtByOrder.set(event.orderId, event.createdAt)
      }
    }

    // Latest refund-request audit log per order carries the source.
    const requestSourceByOrder = new Map<string, RefundRequestSource>()
    for (const log of requestLogs) {
      if (!log.entityId || requestSourceByOrder.has(log.entityId)) continue
      const afterData =
        log.afterData && typeof log.afterData === 'object' && !Array.isArray(log.afterData)
          ? (log.afterData as { source?: unknown })
          : null
      const source = afterData?.source
      requestSourceByOrder.set(
        log.entityId,
        source === 'VENDOR_REJECTION' || source === 'CUSTOMER_CANCEL'
          ? source
          : 'NONE_RECORDED'
      )
    }

    const now = Date.now()
    const items: RefundRequestItem[] = pageOrders.map((order) => {
      const cancelledAt = cancelledAtByOrder.get(order.id) ?? order.updatedAt
      const storeName =
        order.items.find(item => item.product?.store?.name)?.product.store.name ??
        null

      return {
        orderId: order.id,
        orderRef: `#${order.id.slice(-8).toUpperCase()}`,
        cancelledAt: cancelledAt.toISOString(),
        requestSource: requestSourceByOrder.get(order.id) ?? 'NONE_RECORDED',
        total: order.total,
        currency: order.payment?.currency ?? null,
        walletAssisted: (order.walletAmountApplied ?? 0) > 0,
        orderType: order.orderType,
        storeName,
        ageDays: Math.max(
          0,
          Math.floor((now - cancelledAt.getTime()) / (24 * 60 * 60 * 1000))
        ),
        refundStatus: order.refunds[0]?.status ?? null,
      }
    })

    return NextResponse.json({
      items,
      pagination: { page, limit, hasMore },
    })
  } catch (error) {
    logError('Refund request queue failed', error)
    return NextResponse.json(
      { error: 'Failed to load the refund request queue' },
      { status: 500 }
    )
  }
}
