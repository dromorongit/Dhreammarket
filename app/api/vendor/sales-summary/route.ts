import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { rateLimit } from '@/lib/rate-limit'
import {
  MAX_ORDERS_PER_REPORT,
  SalesRangeTooLargeError,
  countMissingCostProducts,
  countVendorOrders,
  iterateVendorOrders,
  loadVendorReceivables,
  loadVendorRefunds,
} from '@/lib/vendor-sales-data'
import {
  SalesSummaryAccumulator,
  validateDateRange,
  validateSourceFilter,
} from '@/lib/sales-summary'
import {
  getCachedSalesSummary,
  salesSummaryCacheKey,
  setCachedSalesSummary,
} from '@/lib/sales-summary-cache'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vendor/sales-summary?from&to&source=ALL|ONLINE|MANUAL
 *
 * The vendor's own money view: revenue, cost of goods sold, profit before
 * other expenses, receivables and the cost coverage of the period. Every
 * figure is scoped to the authenticated vendor's store.
 *
 * The report is read in pages of 500 orders and folded into running totals,
 * so the memory it needs does not grow with the length of the period. A
 * period that covers more than 50,000 orders is refused with a 413.
 */
export async function GET(request: NextRequest) {
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

    if (payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const limit = rateLimit('vendor-sales-summary')(request)
    if (!limit.success) {
      return limit.response
    }

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup to view your sales' },
        { status: 403 }
      )
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)

    const rangeResult = validateDateRange(searchParams.get('from'), searchParams.get('to'))
    if ('error' in rangeResult) {
      return NextResponse.json({ error: rangeResult.error }, { status: 400 })
    }

    const sourceResult = validateSourceFilter(searchParams.get('source'))
    if ('error' in sourceResult) {
      return NextResponse.json({ error: sourceResult.error }, { status: 400 })
    }

    const { from, to } = rangeResult.range
    const source = sourceResult.source

    const cacheKey = salesSummaryCacheKey(store.id, from, to, source)
    const cached = getCachedSalesSummary(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, cached: true })
    }

    const orderCount = await countVendorOrders(store.id, from, to)
    if (orderCount > MAX_ORDERS_PER_REPORT) {
      return NextResponse.json(
        {
          error: 'range too large, choose a shorter period',
          count: orderCount,
          limit: MAX_ORDERS_PER_REPORT,
        },
        { status: 413 }
      )
    }

    const now = new Date()
    const missingCostProducts = await countMissingCostProducts(store.id)

    const accumulator = new SalesSummaryAccumulator({
      from,
      to,
      now,
      source,
      missingCostProducts,
      // The receivables are read all-time below, so the period must not
      // collect them again.
      collectPeriodReceivables: false,
    })

    for await (const order of iterateVendorOrders(store.id, from, to)) {
      accumulator.add(order)
    }

    const [refunds, receivables] = await Promise.all([
      loadVendorRefunds(store.id, from, to),
      loadVendorReceivables(store.id, now),
    ])

    const summary = accumulator.build(refunds, receivables)

    setCachedSalesSummary(cacheKey, summary)

    return NextResponse.json(summary)
  } catch (error) {
    if (error instanceof SalesRangeTooLargeError) {
      return NextResponse.json(
        {
          error: 'range too large, choose a shorter period',
          count: error.count,
          limit: error.limit,
        },
        { status: 413 }
      )
    }

    console.error('Error building vendor sales summary:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
}
