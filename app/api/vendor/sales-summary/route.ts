import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { loadVendorSalesData } from '@/lib/vendor-sales-data'
import {
  buildSalesSummary,
  validateDateRange,
  validateSourceFilter,
} from '@/lib/sales-summary'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vendor/sales-summary?from&to&source=ALL|ONLINE|MANUAL
 *
 * The vendor's own money view: revenue, cost of goods sold, profit before
 * other expenses, receivables and the cost coverage of the period. Every
 * figure is scoped to the authenticated vendor's store.
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
    const now = new Date()

    const data = await loadVendorSalesData(store.id, from, to)

    const summary = buildSalesSummary({
      orders: data.orders,
      refunds: data.refunds,
      from,
      to,
      now,
      source: sourceResult.source,
      missingCostProducts: data.missingCostProducts,
    })

    return NextResponse.json(summary)
  } catch (error) {
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
