import { describe, it, expect } from 'vitest'
import {
  PROFIT_LABEL,
  accraDayEndExclusive,
  accraDayKey,
  accraDayStart,
  buildSalesSummary,
  fromPesewas,
  isCountedSale,
  isReceivable,
  orderCogsPesawas,
  orderRevenuePesawas,
  parseAccraDayKey,
  resolveChannel,
  resolveUnitCostPesawas,
  salesPeriodRange,
  toPesewas,
  validateCostPrice,
  validateDateRange,
  validateDeliveryCost,
  validateSourceFilter,
  type SalesSummaryItemInput,
  type SalesSummaryOrderInput,
} from '@/lib/sales-summary'

function makeItem(overrides: Partial<SalesSummaryItemInput> = {}): SalesSummaryItemInput {
  return {
    id: 'item_1',
    productId: 'p1',
    productVariantId: null,
    productName: 'Widget',
    variantLabel: null,
    quantity: 1,
    price: 20,
    costPriceSnapshot: null,
    variantCostPrice: null,
    productCostPrice: null,
    vendorEarnings: null,
    ...overrides,
  }
}

function makeOrder(overrides: Partial<SalesSummaryOrderInput> = {}): SalesSummaryOrderInput {
  return {
    id: 'order_1',
    source: 'MANUAL',
    channel: 'WHATSAPP',
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    createdAt: new Date('2026-10-10T12:00:00.000Z'),
    total: 20,
    vendorEarnings: null,
    netAmount: null,
    deliveryCost: null,
    items: [makeItem()],
    ...overrides,
  }
}

const RANGE = {
  from: new Date('2026-10-01T00:00:00.000Z'),
  to: new Date('2026-10-31T00:00:00.000Z'),
}

const NOW = new Date('2026-10-20T00:00:00.000Z')

function summary(orders: SalesSummaryOrderInput[], overrides: Partial<Parameters<typeof buildSalesSummary>[0]> = {}) {
  return buildSalesSummary({
    orders,
    refunds: [],
    from: RANGE.from,
    to: RANGE.to,
    now: NOW,
    source: 'ALL',
    missingCostProducts: 0,
    ...overrides,
  })
}

describe('lib/sales-summary pesewa money', () => {
  it('converts cedis to pesewas and back', () => {
    expect(toPesewas(19.99)).toBe(1999)
    expect(toPesewas(0.29)).toBe(29)
    expect(toPesewas(0)).toBe(0)
    expect(fromPesewas(1999)).toBe(19.99)
    expect(fromPesewas(29)).toBe(0.29)
  })

  it('rounds on the decimal, not on the binary error', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in binary
    expect(toPesewas(0.1 + 0.2)).toBe(30)
    // 2.675 * 100 is 267.49999999999997 in binary
    expect(toPesewas(2.675)).toBe(268)
    expect(toPesewas(1.005)).toBe(101)
  })

  it('treats non-finite amounts as zero', () => {
    expect(toPesawasSafe(NaN)).toBe(0)
    expect(toPesawasSafe(Infinity)).toBe(0)
    expect(toPesawasSafe(-Infinity)).toBe(0)
  })
})

function toPesawasSafe(value: number): number {
  return toPesewas(value)
}

describe('lib/sales-summary Africa/Accra day boundaries', () => {
  it('gives the Accra calendar day of an instant', () => {
    expect(accraDayKey(new Date('2026-10-10T23:59:59.999Z'))).toBe('2026-10-10')
    expect(accraDayKey(new Date('2026-10-11T00:00:00.000Z'))).toBe('2026-10-11')
    expect(accraDayKey(new Date('2026-01-01T00:30:00.000Z'))).toBe('2026-01-01')
  })

  it('anchors the start and the exclusive end of a day', () => {
    const late = new Date('2026-10-10T23:30:00.000Z')
    expect(accraDayStart(late).toISOString()).toBe('2026-10-10T00:00:00.000Z')
    expect(accraDayEndExclusive(late).toISOString()).toBe('2026-10-11T00:00:00.000Z')
  })

  it('parses a day key back to Accra midnight', () => {
    expect(parseAccraDayKey('2026-10-10')?.toISOString()).toBe('2026-10-10T00:00:00.000Z')
    expect(parseAccraDayKey('2026-02-30')).toBeNull()
    expect(parseAccraDayKey('2026-13-01')).toBeNull()
    expect(parseAccraDayKey('10-10-2026')).toBeNull()
    expect(parseAccraDayKey('yesterday')).toBeNull()
    expect(parseAccraDayKey(20261010 as unknown as string)).toBeNull()
  })
})

describe('lib/sales-summary input validation', () => {
  it('rejects an inverted or oversized date range', () => {
    expect(validateDateRange('2026-10-10', '2026-10-01', NOW)).toHaveProperty('error')
    expect(validateDateRange('2025-01-01', '2026-10-01', NOW)).toHaveProperty('error')
    expect(validateDateRange('2026-10-01', '2026-10-01', NOW)).not.toHaveProperty('error')
  })

  it('accepts exactly 366 days and refuses 367', () => {
    const ok = validateDateRange('2025-01-01', '2026-01-01', NOW)
    expect(ok).not.toHaveProperty('error')
    if ('range' in ok && ok.range) {
      expect(ok.range.from.toISOString()).toBe('2025-01-01T00:00:00.000Z')
    }

    const tooLong = validateDateRange('2024-12-02', '2026-01-01', NOW)
    expect(tooLong).toHaveProperty('error')
  })

  it('rejects malformed dates', () => {
    expect(validateDateRange('2026-10-01', 'nope', NOW)).toHaveProperty('error')
    expect(validateDateRange('nope', '2026-10-01', NOW)).toHaveProperty('error')
  })

  it('defaults to the last 30 Accra days', () => {
    const result = validateDateRange(null, null, NOW)
    expect(result).not.toHaveProperty('error')
    if ('range' in result && result.range) {
      expect(result.range.to.toISOString()).toBe('2026-10-20T00:00:00.000Z')
      expect(result.range.from.toISOString()).toBe('2026-09-21T00:00:00.000Z')
    }
  })

  it('validates the source filter', () => {
    expect(validateSourceFilter('ALL')).toEqual({ source: 'ALL' })
    expect(validateSourceFilter('online')).toEqual({ source: 'ONLINE' })
    expect(validateSourceFilter('MANUAL')).toEqual({ source: 'MANUAL' })
    expect(validateSourceFilter(undefined)).toEqual({ source: 'ALL' })
    expect(validateSourceFilter('SOMETHING')).toHaveProperty('error')
  })

  it('validates cost prices', () => {
    expect(validateCostPrice(12.5)).toEqual({ provided: true, pesewas: 1250 })
    expect(validateCostPrice(0)).toEqual({ provided: true, pesewas: 0 })
    expect(validateCostPrice(undefined)).toEqual({ provided: false })
    expect(validateCostPrice(null)).toEqual({ provided: false })
    expect(validateCostPrice(-1)).toHaveProperty('error')
    expect(validateCostPrice(1.234)).toHaveProperty('error')
    expect(validateCostPrice('10')).toHaveProperty('error')
  })

  it('validates delivery costs', () => {
    expect(validateDeliveryCost(7.5)).toEqual({ provided: true, pesewas: 750 })
    expect(validateDeliveryCost('')).toEqual({ provided: false })
    expect(validateDeliveryCost(-0.01)).toHaveProperty('error')
    expect(validateDeliveryCost(1.005)).toHaveProperty('error')
  })
})

describe('lib/sales-summary counting rules', () => {
  it('counts only paid, non-cancelled orders', () => {
    expect(isCountedSale({ paymentStatus: 'PAID', status: 'PROCESSING' })).toBe(true)
    expect(isCountedSale({ paymentStatus: 'PAID', status: 'CANCELLED' })).toBe(false)
    expect(isCountedSale({ paymentStatus: 'PENDING', status: 'PROCESSING' })).toBe(false)
    expect(isCountedSale({ paymentStatus: 'REFUNDED', status: 'PROCESSING' })).toBe(false)
  })

  it('treats unpaid manual sales as receivables only', () => {
    expect(isReceivable({ source: 'MANUAL', paymentStatus: 'PENDING', status: 'PROCESSING' })).toBe(true)
    expect(isReceivable({ source: 'MANUAL', paymentStatus: 'PENDING', status: 'CANCELLED' })).toBe(false)
    expect(isReceivable({ source: 'ONLINE', paymentStatus: 'PENDING', status: 'PROCESSING' })).toBe(false)
    expect(isReceivable({ source: 'MANUAL', paymentStatus: 'PAID', status: 'PROCESSING' })).toBe(false)
  })

  it('counts every online sale as Marketplace', () => {
    expect(resolveChannel({ source: 'ONLINE', channel: 'WHATSAPP' })).toBe('MARKETPLACE')
    expect(resolveChannel({ source: 'MANUAL', channel: 'WHATSAPP' })).toBe('WHATSAPP')
    expect(resolveChannel({ source: 'MANUAL', channel: 'WALK_IN' })).toBe('WALK_IN')
    expect(resolveChannel({ source: 'MANUAL', channel: null })).toBe('OTHER')
    expect(resolveChannel({ source: 'MANUAL', channel: 'SOMETHING' })).toBe('OTHER')
  })
})

describe('lib/sales-summary cost resolution', () => {
  it('prefers the sale-time snapshot for manual sales', () => {
    const cost = resolveUnitCostPesawas(
      { source: 'MANUAL' },
      { costPriceSnapshot: 5, variantCostPrice: 8, productCostPrice: 10 },
    )
    expect(cost).toBe(500)
  })

  it('falls back to the variant cost, then the product cost', () => {
    expect(
      resolveUnitCostPesawas(
        { source: 'MANUAL' },
        { costPriceSnapshot: null, variantCostPrice: 8, productCostPrice: 10 },
      ),
    ).toBe(800)
    expect(
      resolveUnitCostPesawas(
        { source: 'MANUAL' },
        { costPriceSnapshot: null, variantCostPrice: null, productCostPrice: 10 },
      ),
    ).toBe(1000)
  })

  it('uses the current cost for online sales', () => {
    expect(
      resolveUnitCostPesawas(
        { source: 'ONLINE' },
        { costPriceSnapshot: null, variantCostPrice: null, productCostPrice: 10 },
      ),
    ).toBe(1000)
  })

  it('returns null when no cost is known', () => {
    expect(
      resolveUnitCostPesawas(
        { source: 'MANUAL' },
        { costPriceSnapshot: null, variantCostPrice: null, productCostPrice: null },
      ),
    ).toBeNull()
  })
})

describe('lib/sales-summary revenue and cost bases', () => {
  it('uses the order total for a manual sale', () => {
    const order = makeOrder({ total: 45.5, items: [makeItem({ price: 40 })] })
    expect(orderRevenuePesawas(order)).toBe(4550)
  })

  it('uses the vendor share of the order for an online sale', () => {
    const order = makeOrder({
      source: 'ONLINE',
      total: 100,
      vendorEarnings: 90,
      items: [
        makeItem({ id: 'i1', price: 60, vendorEarnings: 54 }),
        makeItem({ id: 'i2', price: 40, vendorEarnings: 36 }),
      ],
    })
    expect(orderRevenuePesawas(order)).toBe(9000)
  })

  it('falls back to the order earnings when an online line has none', () => {
    const order = makeOrder({
      source: 'ONLINE',
      total: 100,
      vendorEarnings: 90,
      items: [makeItem({ price: 100, vendorEarnings: null })],
    })
    expect(orderRevenuePesawas(order)).toBe(9000)
  })

  it('excludes items with no cost from COGS and counts them', () => {
    const result = orderCogsPesawas(
      makeOrder({
        items: [
          makeItem({ id: 'i1', quantity: 2, productCostPrice: 5 }),
          makeItem({ id: 'i2', quantity: 1, productCostPrice: null }),
        ],
      }),
    )
    expect(result.cogsPesawas).toBe(1000)
    expect(result.items).toBe(2)
    expect(result.itemsWithCost).toBe(1)
    expect(result.missingCostItems).toBe(1)
    expect(result.units).toBe(3)
  })
})

describe('lib/sales-summary buildSalesSummary', () => {
  it('counts revenue, cost and profit for a manual sale', () => {
    const result = summary([
      makeOrder({
        total: 30,
        deliveryCost: 5,
        items: [makeItem({ quantity: 2, price: 12.5, productCostPrice: 5 })],
      }),
    ])

    expect(result.totals.revenue).toBe(30)
    expect(result.totals.cogs).toBe(10)
    expect(result.totals.deliveryCost).toBe(5)
    expect(result.totals.profit).toBe(15)
    expect(result.profitLabel).toBe(PROFIT_LABEL)
    expect(result.totals.profitLabel).toBe('Profit before other expenses')
    expect(result.totals.orders).toBe(1)
    expect(result.totals.units).toBe(2)
  })

  it('never presents an exact profit when the cost data is incomplete', () => {
    const result = summary([
      makeOrder({
        total: 30,
        items: [makeItem({ quantity: 1, price: 30, productCostPrice: null })],
      }),
    ])

    expect(result.totals.cogs).toBe(0)
    expect(result.totals.missingCostItems).toBe(1)
    expect(result.totals.costCoveragePercent).toBe(0)
    expect(result.totals.profitIsExact).toBe(false)
    expect(result.totals.estimated).toBe(true)
    expect(result.totals.estimatedReasons).toContain('missing_cost_prices')
  })

  it('reports 100% coverage when every line has a cost', () => {
    const result = summary([
      makeOrder({
        items: [
          makeItem({ id: 'i1', productCostPrice: 5 }),
          makeItem({ id: 'i2', variantCostPrice: 7 }),
        ],
      }),
    ])
    expect(result.totals.costCoveragePercent).toBe(100)
    expect(result.coverage.items).toBe(2)
    expect(result.coverage.itemsWithCost).toBe(2)
  })

  it('treats a missing delivery cost as unknown only for manual sales', () => {
    const manual = summary([
      makeOrder({
        total: 30,
        deliveryCost: null,
        items: [makeItem({ quantity: 1, price: 30, productCostPrice: 5 })],
      }),
    ])
    expect(manual.totals.estimatedReasons).toContain('unknown_delivery_cost')
    expect(manual.totals.profitIsExact).toBe(false)

    // The platform delivers an online sale, so it has no delivery cost to know.
    const online = summary([
      makeOrder({
        source: 'ONLINE',
        channel: null,
        total: 30,
        deliveryCost: null,
        items: [makeItem({ quantity: 1, price: 30, vendorEarnings: 27 })],
      }),
    ])
    expect(online.totals.estimatedReasons).not.toContain('unknown_delivery_cost')
    expect(online.totals.estimatedReasons).toContain('online_current_cost')
  })

  it('calls a fully priced manual sale exact', () => {
    const result = summary([
      makeOrder({
        total: 30,
        deliveryCost: 3,
        items: [makeItem({ quantity: 1, price: 30, productCostPrice: 5 })],
      }),
    ])
    expect(result.totals.profitIsExact).toBe(true)
    expect(result.totals.estimated).toBe(false)
    expect(result.totals.profit).toBe(22)
  })

  it('leaves out cancelled and unpaid orders', () => {
    const result = summary([
      makeOrder({ id: 'paid', total: 10 }),
      makeOrder({ id: 'cancelled', total: 99, status: 'CANCELLED' }),
      makeOrder({ id: 'unpaid', total: 77, paymentStatus: 'PENDING' }),
    ])

    expect(result.totals.orders).toBe(1)
    expect(result.totals.revenue).toBe(10)
  })

  it('leaves out orders outside the period', () => {
    const result = summary([
      makeOrder({ id: 'inside', createdAt: new Date('2026-10-10T12:00:00.000Z') }),
      makeOrder({ id: 'before', createdAt: new Date('2026-09-30T23:59:59.000Z') }),
      makeOrder({ id: 'after', createdAt: new Date('2026-11-01T00:00:00.000Z') }),
    ])

    expect(result.totals.orders).toBe(1)
  })

  it('uses vendor earnings for online sales and the total for manual sales', () => {
    const result = summary([
      makeOrder({
        id: 'online',
        source: 'ONLINE',
        channel: null,
        total: 100,
        vendorEarnings: 90,
        items: [makeItem({ price: 100, vendorEarnings: 90 })],
      }),
      makeOrder({
        id: 'manual',
        source: 'MANUAL',
        total: 40,
        items: [makeItem({ id: 'i2', price: 40 })],
      }),
    ])

    expect(result.totals.revenue).toBe(130)
    const online = result.bySource.find((row) => row.key === 'ONLINE')
    const manual = result.bySource.find((row) => row.key === 'MANUAL')
    expect(online?.revenue).toBe(90)
    expect(manual?.revenue).toBe(40)
    expect(online?.label).toBe('Online')
    expect(manual?.label).toBe('Manual')
  })

  it('splits the sales by channel and counts online as Marketplace', () => {
    const result = summary([
      makeOrder({ id: 'o1', source: 'ONLINE', channel: null, total: 10 }),
      makeOrder({ id: 'o2', source: 'MANUAL', channel: 'WHATSAPP', total: 20 }),
      makeOrder({ id: 'o3', source: 'MANUAL', channel: 'WALK_IN', total: 30 }),
    ])

    const marketplace = result.byChannel.find((row) => row.key === 'MARKETPLACE')
    const whatsapp = result.byChannel.find((row) => row.key === 'WHATSAPP')
    const walkIn = result.byChannel.find((row) => row.key === 'WALK_IN')
    expect(marketplace?.label).toBe('Marketplace')
    expect(marketplace?.revenue).toBe(10)
    expect(whatsapp?.revenue).toBe(20)
    expect(walkIn?.revenue).toBe(30)
  })

  it('builds a daily series for the chart', () => {
    const result = summary([
      makeOrder({ id: 'o1', createdAt: new Date('2026-10-01T09:00:00.000Z'), total: 10 }),
      makeOrder({ id: 'o2', createdAt: new Date('2026-10-01T18:00:00.000Z'), total: 15 }),
      makeOrder({ id: 'o3', createdAt: new Date('2026-10-03T09:00:00.000Z'), total: 5 }),
    ])

    expect(result.daily).toHaveLength(31)
    const first = result.daily[0]
    expect(first.date).toBe('2026-10-01')
    expect(first.orders).toBe(2)
    expect(first.revenue).toBe(25)
    const third = result.daily[2]
    expect(third.date).toBe('2026-10-03')
    expect(third.revenue).toBe(5)
    expect(result.daily[4].revenue).toBe(0)
  })

  it('ranks the top products by units and by profit', () => {
    const result = summary([
      makeOrder({
        id: 'o1',
        total: 40,
        items: [makeItem({ id: 'i1', productId: 'p1', productName: 'Widget', quantity: 2, price: 20, productCostPrice: 5 })],
      }),
      makeOrder({
        id: 'o2',
        total: 30,
        items: [makeItem({ id: 'i2', productId: 'p2', productName: 'Gadget', quantity: 3, price: 10, productCostPrice: 1 })],
      }),
    ])

    expect(result.topProductsByUnits[0].productName).toBe('Gadget')
    expect(result.topProductsByUnits[0].units).toBe(3)
    expect(result.topProductsByProfit[0].productName).toBe('Widget')
    expect(result.topProductsByProfit[0].profit).toBe(30)
  })

  it('collects the receivables with the oldest age', () => {
    const result = summary([
      makeOrder({
        id: 'r1',
        paymentStatus: 'PENDING',
        total: 50,
        createdAt: new Date('2026-10-05T10:00:00.000Z'),
        customerFirstName: 'Kofi',
        customerLastName: 'Mensah',
        customerPhone: '+233242222222',
        receiptToken: 'abc123',
      }),
      makeOrder({
        id: 'r2',
        paymentStatus: 'PENDING',
        total: 25,
        createdAt: new Date('2026-10-18T10:00:00.000Z'),
        customerFirstName: 'Ama',
      }),
    ])

    expect(result.receivables.count).toBe(2)
    expect(result.receivables.amount).toBe(75)
    expect(result.receivables.oldestAgeDays).toBe(15)
    expect(result.receivables.orders[0].id).toBe('r1')
    expect(result.receivables.orders[0].customerName).toBe('Kofi Mensah')
    // An unpaid manual sale is not revenue.
    expect(result.totals.revenue).toBe(0)
  })

  it('reports refunded totals separately and keeps them out of revenue', () => {
    const result = summary(
      [makeOrder({ id: 'refunded', paymentStatus: 'REFUNDED', total: 60 })],
      {
        refunds: [
          { id: 'ref1', orderId: 'refunded', amount: 60, status: 'PROCESSED', createdAt: new Date('2026-10-12T00:00:00.000Z') },
          { id: 'ref2', orderId: 'other', amount: 10, status: 'PENDING', createdAt: new Date('2026-10-12T00:00:00.000Z') },
        ],
      },
    )

    expect(result.totals.revenue).toBe(0)
    expect(result.refunds.amount).toBe(70)
    expect(result.refunds.processedAmount).toBe(60)
    expect(result.refunds.pendingAmount).toBe(10)
    expect(result.refunds.count).toBe(2)
  })

  it('filters by source when asked to', () => {
    const orders = [
      makeOrder({ id: 'o1', source: 'ONLINE', channel: null, total: 10, vendorEarnings: 9, items: [makeItem({ vendorEarnings: 9 })] }),
      makeOrder({ id: 'o2', source: 'MANUAL', total: 20 }),
    ]

    const onlineOnly = summary(orders, { source: 'ONLINE' })
    expect(onlineOnly.totals.orders).toBe(1)
    expect(onlineOnly.totals.revenue).toBe(9)

    const manualOnly = summary(orders, { source: 'MANUAL' })
    expect(manualOnly.totals.orders).toBe(1)
    expect(manualOnly.totals.revenue).toBe(20)
  })

  it('reports the range it covered', () => {
    const result = summary([])
    expect(result.range.from).toBe('2026-10-01')
    expect(result.range.to).toBe('2026-10-31')
    expect(result.range.days).toBe(31)
  })
})

describe('lib/sales-summary period picking', () => {
  it('covers today, 7 days, 30 days and the current month', () => {
    expect(salesPeriodRange('today', NOW)).toEqual({ from: '2026-10-20', to: '2026-10-20' })
    expect(salesPeriodRange('7d', NOW)).toEqual({ from: '2026-10-14', to: '2026-10-20' })
    expect(salesPeriodRange('30d', NOW)).toEqual({ from: '2026-09-21', to: '2026-10-20' })
    expect(salesPeriodRange('month', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-20' })
  })

  it('uses the custom days when asked to', () => {
    expect(
      salesPeriodRange('custom', NOW, { from: '2026-01-01', to: '2026-01-31' }),
    ).toEqual({ from: '2026-01-01', to: '2026-01-31' })
  })
})
