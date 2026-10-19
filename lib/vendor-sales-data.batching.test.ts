import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  product: { count: vi.fn(), findMany: vi.fn() },
  order: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    aggregate: vi.fn(),
  },
  refund: { findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

import {
  MAX_ORDERS_PER_REPORT,
  SalesRangeTooLargeError,
  iterateVendorOrders,
  loadVendorSalesData,
} from '@/lib/vendor-sales-data'
import { SalesSummaryAccumulator, buildSalesSummary } from '@/lib/sales-summary'
import {
  createFakeSalesPrisma,
  type FakeOrder,
  type FakeProduct,
} from '@/app/api/vendor/sales-summary/fake-sales-db.test-utils'

const FROM = new Date('2026-10-01T00:00:00.000Z')
const TO = new Date('2026-10-31T00:00:00.000Z')
const NOW = new Date('2026-11-02T00:00:00.000Z')

const PRODUCTS: FakeProduct[] = [
  {
    id: 'prod_1',
    storeId: 'store_1',
    name: 'Widget',
    price: 20,
    costPrice: 5,
    variants: [],
  },
]

/**
 * A fixture of orders spread over the period, mixing the sources and the
 * payment states so the two paths have something to disagree about if they
 * ever do.
 */
function buildFixture(size: number): FakeOrder[] {
  return Array.from({ length: size }, (_, index) => {
    const day = 1 + (index % 30)
    const paid = index % 5 !== 0
    return {
      id: `order_${String(index).padStart(4, '0')}`,
      source: index % 3 === 0 ? 'ONLINE' : 'MANUAL',
      channel: index % 3 === 0 ? null : 'WHATSAPP',
      status: index % 11 === 0 ? 'CANCELLED' : 'PROCESSING',
      paymentStatus: paid ? 'PAID' : 'PENDING',
      createdAt: new Date(Date.UTC(2026, 9, day, 8, index % 60)),
      total: 20 + (index % 7) * 5,
      vendorEarnings: index % 3 === 0 ? 12 + (index % 5) : null,
      netAmount: index % 3 === 0 ? 14 + (index % 5) : null,
      deliveryCost: index % 3 === 0 ? null : 5,
      customerFirstName: `Customer${index}`,
      customerLastName: null,
      customerPhone: null,
      receiptToken: null,
      paymentMethod: 'CASH',
      deletedAt: null,
      items: [
        {
          id: `item_${index}`,
          productId: 'prod_1',
          productVariantId: null,
          quantity: 1 + (index % 3),
          price: 20,
          costPriceSnapshot: index % 3 === 0 ? null : 5,
          vendorEarnings: index % 3 === 0 ? 12 + (index % 5) : null,
          product: { id: 'prod_1', name: 'Widget', costPrice: 5 },
          productVariant: null,
        },
      ],
    }
  })
}

function useFakeDb(orders: FakeOrder[]) {
  const fake = createFakeSalesPrisma({
    store: { id: 'store_1', userId: 'vendor_1' },
    products: PRODUCTS,
    orders,
    refunds: [],
  })

  prismaMock.store.findUnique.mockImplementation(fake.store.findUnique)
  prismaMock.product.count.mockImplementation(fake.product.count)
  prismaMock.product.findMany.mockImplementation(fake.product.findMany)
  prismaMock.order.count.mockImplementation(fake.order.count)
  prismaMock.order.findMany.mockImplementation(fake.order.findMany)
  prismaMock.order.findFirst.mockImplementation(fake.order.findFirst)
  prismaMock.order.aggregate.mockImplementation(fake.order.aggregate)
  prismaMock.refund.findMany.mockImplementation(fake.refund.findMany)

  return fake
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the batched report agrees with the single-query report', () => {
  it('gives the same totals on a fixture of 1200 orders', async () => {
    const fixture = buildFixture(1200)
    useFakeDb(fixture)

    const single = await loadVendorSalesData('store_1', FROM, TO)
    const singleSummary = buildSalesSummary({
      orders: single.orders,
      refunds: single.refunds,
      from: FROM,
      to: TO,
      now: NOW,
      source: 'ALL',
      missingCostProducts: single.missingCostProducts,
    })

    const accumulator = new SalesSummaryAccumulator({
      from: FROM,
      to: TO,
      now: NOW,
      source: 'ALL',
      missingCostProducts: single.missingCostProducts,
      collectPeriodReceivables: false,
    })

    let seen = 0
    for await (const order of iterateVendorOrders('store_1', FROM, TO)) {
      accumulator.add(order)
      seen += 1
    }

    expect(seen).toBe(1200)

    const batchedSummary = accumulator.build(single.refunds)

    expect(batchedSummary.totals).toEqual(singleSummary.totals)
    expect(batchedSummary.bySource).toEqual(singleSummary.bySource)
    expect(batchedSummary.byChannel).toEqual(singleSummary.byChannel)
    expect(batchedSummary.daily).toEqual(singleSummary.daily)
    expect(batchedSummary.topProductsByUnits).toEqual(singleSummary.topProductsByUnits)
    expect(batchedSummary.topProductsByProfit).toEqual(singleSummary.topProductsByProfit)
    expect(batchedSummary.coverage).toEqual(singleSummary.coverage)
  })

  it('gives the same totals whatever the page size is', async () => {
    const fixture = buildFixture(97)
    useFakeDb(fixture)

    const single = await loadVendorSalesData('store_1', FROM, TO)

    const totals: number[] = []
    for (const batchSize of [1, 7, 50, 500]) {
      const accumulator = new SalesSummaryAccumulator({
        from: FROM,
        to: TO,
        now: NOW,
        source: 'ALL',
        missingCostProducts: 0,
        collectPeriodReceivables: false,
      })

      for await (const order of iterateVendorOrders('store_1', FROM, TO, { batchSize })) {
        accumulator.add(order)
      }

      totals.push(accumulator.build(single.refunds).totals.revenuePesawas)
    }

    expect(new Set(totals).size).toBe(1)
    expect(totals[0]).toBe(
      buildSalesSummary({
        orders: single.orders,
        refunds: single.refunds,
        from: FROM,
        to: TO,
        now: NOW,
        source: 'ALL',
        missingCostProducts: 0,
      }).totals.revenuePesawas,
    )
  })

  it('keeps the same receivables as the period report', async () => {
    const fixture = buildFixture(40)
    useFakeDb(fixture)

    const single = await loadVendorSalesData('store_1', FROM, TO)
    const singleSummary = buildSalesSummary({
      orders: single.orders,
      refunds: single.refunds,
      from: FROM,
      to: TO,
      now: NOW,
      source: 'ALL',
      missingCostProducts: 0,
    })

    const accumulator = new SalesSummaryAccumulator({
      from: FROM,
      to: TO,
      now: NOW,
      source: 'ALL',
      missingCostProducts: 0,
    })

    for await (const order of iterateVendorOrders('store_1', FROM, TO)) {
      accumulator.add(order)
    }

    const batchedSummary = accumulator.build(single.refunds)

    expect(batchedSummary.receivables.count).toBe(singleSummary.receivables.count)
    expect(batchedSummary.receivables.amountPesawas).toBe(singleSummary.receivables.amountPesawas)
    expect(batchedSummary.receivables.oldestAgeDays).toBe(singleSummary.receivables.oldestAgeDays)
  })
})

describe('the batched report refuses a period that is too long', () => {
  it('stops at the cap and says the range is too large', async () => {
    const fixture = buildFixture(120)
    useFakeDb(fixture)

    const seen: string[] = []
    let thrown: unknown = null

    try {
      for await (const order of iterateVendorOrders('store_1', FROM, TO, { maxOrders: 50 })) {
        seen.push(order.id)
      }
    } catch (error) {
      thrown = error
    }

    expect(seen).toHaveLength(50)
    expect(thrown).toBeInstanceOf(SalesRangeTooLargeError)
    expect((thrown as SalesRangeTooLargeError).limit).toBe(50)
    expect((thrown as SalesRangeTooLargeError).message).toMatch(
      /range too large, choose a shorter period/,
    )
  })

  it('caps a report at 50,000 orders by default', async () => {
    expect(MAX_ORDERS_PER_REPORT).toBe(50_000)
  })
})
