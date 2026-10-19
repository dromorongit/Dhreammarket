import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { rateLimit } from '@/lib/rate-limit'
import {
  MAX_ORDERS_PER_REPORT,
  SalesRangeTooLargeError,
  countVendorOrders,
  iterateVendorOrders,
} from '@/lib/vendor-sales-data'
import {
  accraDayKey,
  countsInTotals,
  fromPesewas,
  orderCogsPesawas,
  orderRevenuePesawas,
  resolveChannel,
  salesDisplayNumber,
  toPesewas,
  validateDateRange,
  validateSourceFilter,
  type SalesSummaryOrderInput,
  type SalesSourceFilter,
} from '@/lib/sales-summary'
import { CSV_BOM, buildCsvRow, csvFileName } from '@/lib/csv'

export const dynamic = 'force-dynamic'

const CSV_HEADERS = [
  'date',
  'order number',
  'channel',
  'customer name',
  'items',
  'revenue',
  'cost',
  'delivery cost',
  'profit',
  'payment status',
  'payment method',
  'counted_in_totals',
]

/**
 * "2 x Widget - Red / Large; 1 x Gadget"
 */
function describeItems(order: SalesSummaryOrderInput): string {
  return (order.items || [])
    .map((item) => {
      const label = item.variantLabel
        ? `${item.productName} - ${item.variantLabel}`
        : item.productName
      return `${item.quantity} x ${label}`
    })
    .join('; ')
}

function buildCsvValues(order: SalesSummaryOrderInput, source: SalesSourceFilter): unknown[] {
  const revenuePesawas = orderRevenuePesawas(order)
  const cogsPesawas = orderCogsPesawas(order).cogsPesawas
  const deliveryCostPesawas =
    order.deliveryCost === null || order.deliveryCost === undefined
      ? 0
      : toPesewas(order.deliveryCost)
  const profitPesawas = revenuePesawas - cogsPesawas - deliveryCostPesawas

  return [
    accraDayKey(order.createdAt),
    salesDisplayNumber(order.id),
    resolveChannel(order),
    order.customerName ?? null,
    describeItems(order),
    fromPesewas(revenuePesawas),
    fromPesewas(cogsPesawas),
    fromPesewas(deliveryCostPesawas),
    fromPesewas(profitPesawas),
    order.paymentStatus,
    order.paymentMethod ?? null,
    // Whether the summary counts this row. The rows that are not counted
    // (an unpaid manual sale, a cancelled order, an order of the other
    // source) are still listed, but they are not part of the totals.
    countsInTotals(order, source) ? 'Yes' : 'No',
  ]
}

/**
 * GET /api/vendor/sales-summary/export?from&to&source=ALL|ONLINE|MANUAL
 *
 * A CSV of the vendor's own orders in the period. The file is UTF-8 with a
 * BOM so Excel opens it correctly, and every cell is escaped against CSV
 * formula injection.
 *
 * The rows are streamed: the orders are read in pages and written out as they
 * arrive, so the export never holds the whole file in memory.
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

    const limit = rateLimit('vendor-sales-export')(request)
    if (!limit.success) {
      return limit.response
    }

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup to export your sales' },
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

    // The size of the report is checked before the stream starts, so a range
    // that is too large is answered with a 413 and not with a broken file.
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

    const fileName = csvFileName('dhreamarket-sales', accraDayKey(from), accraDayKey(to))
    const encoder = new TextEncoder()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(CSV_BOM))
          controller.enqueue(encoder.encode(`${buildCsvRow(CSV_HEADERS)}\r\n`))

          for await (const order of iterateVendorOrders(store.id, from, to)) {
            if (source !== 'ALL' && order.source !== source) continue
            controller.enqueue(
              encoder.encode(`${buildCsvRow(buildCsvValues(order, source))}\r\n`),
            )
          }

          controller.close()
        } catch (error) {
          if (error instanceof SalesRangeTooLargeError) {
            console.error('Vendor sales export is too large:', error.message)
          } else {
            console.error('Error streaming vendor sales export:', error)
          }
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    })
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

    console.error('Error exporting vendor sales:', error)
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
