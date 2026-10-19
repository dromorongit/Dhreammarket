import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { loadVendorSalesData } from '@/lib/vendor-sales-data'
import {
  accraDayKey,
  fromPesewas,
  orderCogsPesawas,
  orderRevenuePesawas,
  resolveChannel,
  salesDisplayNumber,
  toPesewas,
  validateDateRange,
  validateSourceFilter,
  type SalesSummaryOrderInput,
} from '@/lib/sales-summary'
import { CSV_BOM, buildCsv, csvFileName } from '@/lib/csv'

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

function buildCsvRow(order: SalesSummaryOrderInput): unknown[] {
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
  ]
}

/**
 * GET /api/vendor/sales-summary/export?from&to
 *
 * A CSV of the vendor's own orders in the period. The file is UTF-8 with a
 * BOM so Excel opens it correctly, and every cell is escaped against CSV
 * formula injection.
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
    const data = await loadVendorSalesData(store.id, from, to)

    const rows = data.orders
      .filter(
        (order) => sourceResult.source === 'ALL' || order.source === sourceResult.source,
      )
      .map(buildCsvRow)

    const csv = buildCsv(CSV_HEADERS, rows)
    const fileName = csvFileName('dhreamarket-sales', accraDayKey(from), accraDayKey(to))

    return new Response(`${CSV_BOM}${csv}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    })
  } catch (error) {
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
