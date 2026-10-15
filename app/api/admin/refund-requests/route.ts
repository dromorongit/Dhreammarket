import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { rateLimit } from '@/lib/rate-limit'
import { getPrisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { toPesewas } from '@/lib/refunds/process-refund'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100
const MAX_CANDIDATES = 500

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
  /**
   * Refunded so far, in integer pesewas. Reported alongside the order total so
   * a partly refunded order shows how much of its money has gone back.
   */
  refundedPesewas: number
  /**
   * The order's charged amount in integer pesewas. The comparison
   * "refundedPesewas >= paymentPesewas" is how a reader tells whether the
   * refunds cover the payment, without ever trusting floating-point money.
   */
  paymentPesewas: number
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
 * The query therefore already keeps an order visible until its PROCESSED
 * refunds cover the payment, because a PROCESSED refund row is what removes
 * it. The one case the query cannot see on its own is an order whose refunds
 * are all PROCESSED but whose paymentStatus has not yet been flipped, which
 * settleOrderIfFullyRefunded does on the same path; the post-filter below
 * handles it independently so a lag between the two can never double-report
 * an order as still waiting.
 *
 * Every item carries refundedPesewas and paymentPesewas so a partly refunded
 * order shows how much of its money has gone back, compared in integer
 * pesewas rather than floating point.
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

    // Fetch ALL candidate orders (capped at MAX_CANDIDATES) so the "refunded covers payment"
    // filter can be applied correctly before pagination. Refund requests are
    // typically few; MAX_CANDIDATES is a safe ceiling that keeps memory bounded.
    const prisma = getPrisma()
    const ALL_CANDIDATES = await prisma.order.findMany({
      where: {
        status: 'CANCELLED',
        paymentStatus: 'PAID',
        deletedAt: null,
        refunds: { none: { status: { in: [...ACTIVE_REFUND_STATUSES] } } },
      },
      include: {
        payment: { select: { currency: true, amount: true } },
        items: {
          include: {
            product: {
              select: { store: { select: { name: true } } },
            },
          },
        },
        refunds: {
          select: { status: true, createdAt: true, amount: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: MAX_CANDIDATES,
    })

    const isTruncated = ALL_CANDIDATES.length === MAX_CANDIDATES

    // Refunded so far per order, in integer pesewas.
    const refundedPesewasByOrder = new Map<string, number>()
    for (const order of ALL_CANDIDATES) {
      const refundedPesewas = order.refunds
        .filter(refund => refund.status === 'PROCESSED')
        .reduce((sum, refund) => sum + toPesewas(refund.amount), 0)
      refundedPesewasByOrder.set(order.id, refundedPesewas)
    }

    // Filter out orders whose PROCESSED refunds already cover the payment.
    const filteredOrders = ALL_CANDIDATES.filter(order => {
      const paymentPesewas = toPesewas(order.payment?.amount ?? order.total)
      const refundedPesewas = refundedPesewasByOrder.get(order.id) ?? 0
      return refundedPesewas < paymentPesewas
    })

    // Paginate the filtered list.
    const start = (page - 1) * limit
    const pageOrders = filteredOrders.slice(start, start + limit)
    const hasMore = start + limit < filteredOrders.length

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

    const items: RefundRequestItem[] = pageOrders
      .map((order) => {
        const cancelledAt = cancelledAtByOrder.get(order.id) ?? order.updatedAt
        const storeName =
          order.items.find(item => item.product?.store?.name)?.product.store.name ??
          null

        const paymentPesewas = toPesewas(order.payment?.amount ?? order.total)
        const refundedPesewas = refundedPesewasByOrder.get(order.id) ?? 0

        return {
          orderId: order.id,
          orderRef: `#${order.id.slice(-8).toUpperCase()}`,
          cancelledAt: cancelledAt.toISOString(),
          requestSource: requestSourceByOrder.get(order.id) ?? 'NONE_RECORDED',
          total: order.total,
          refundedPesewas,
          paymentPesewas,
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
      // An order whose refunds already cover the payment is not waiting for a
      // decision, even if settleOrderIfFullyRefunded has not flipped its
      // paymentStatus yet. The comparison is in integer pesewas, so a
      // one-pesewa gap is never decided by floating-point noise.
      .filter(item => item.refundedPesewas < item.paymentPesewas)

    return NextResponse.json({
      items,
      pagination: { page, limit, hasMore, truncated: isTruncated },
      notice: isTruncated
        ? `Only the first ${MAX_CANDIDATES} refund requests are shown. Refine your filters or use pagination to view more.`
        : undefined,
    })
  } catch (error) {
    logError('Refund request queue failed', error)
    return NextResponse.json(
      { error: 'Failed to load the refund request queue' },
      { status: 500 }
    )
  }
}
