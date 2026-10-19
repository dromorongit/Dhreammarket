import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  product: { count: vi.fn() },
  order: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    aggregate: vi.fn(),
  },
  refund: { findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

import { GET } from '@/app/api/vendor/sales-summary/route'
import { clearSalesSummaryCache, salesSummaryCacheSize } from '@/lib/sales-summary-cache'
import {
  createFakeSalesPrisma,
  type FakeOrder,
  type FakeProduct,
  type FakeRefund,
} from '@/app/api/vendor/sales-summary/fake-sales-db.test-utils'

const VENDOR_A = {
  authenticated: true,
  userId: 'vendor_a',
  role: 'VENDOR',
  sessionId: 'sess_a',
}

const VENDOR_B = {
  authenticated: true,
  userId: 'vendor_b',
  role: 'VENDOR',
  sessionId: 'sess_b',
}

const PRODUCTS: FakeProduct[] = [
  {
    id: 'prod_a1',
    storeId: 'store_a',
    name: 'Vendor A Widget',
    price: 20,
    costPrice: 5,
    variants: [],
  },
  {
    id: 'prod_b1',
    storeId: 'store_b',
    name: 'Vendor B Gadget',
    price: 80,
    costPrice: 30,
    variants: [],
  },
]

const ORDERS: FakeOrder[] = [
  {
    id: 'order_a1',
    source: 'MANUAL',
    channel: 'WHATSAPP',
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    createdAt: new Date('2026-10-10T12:00:00.000Z'),
    total: 40,
    vendorEarnings: null,
    netAmount: null,
    deliveryCost: 5,
    customerFirstName: 'Kofi',
    customerLastName: 'Mensah',
    customerPhone: '+233242222222',
    receiptToken: 'receipt_a1',
    paymentMethod: 'CASH',
    deletedAt: null,
    items: [
      {
        id: 'item_a1',
        productId: 'prod_a1',
        productVariantId: null,
        quantity: 2,
        price: 20,
        costPriceSnapshot: 5,
        vendorEarnings: null,
        product: { id: 'prod_a1', name: 'Vendor A Widget', costPrice: 5 },
        productVariant: null,
      },
    ],
  },
  {
    id: 'order_b1',
    source: 'MANUAL',
    channel: 'INSTAGRAM',
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    createdAt: new Date('2026-10-11T12:00:00.000Z'),
    total: 80,
    vendorEarnings: null,
    netAmount: null,
    deliveryCost: null,
    customerFirstName: 'Ama',
    customerLastName: null,
    customerPhone: null,
    receiptToken: null,
    paymentMethod: null,
    deletedAt: null,
    items: [
      {
        id: 'item_b1',
        productId: 'prod_b1',
        productVariantId: null,
        quantity: 1,
        price: 80,
        costPriceSnapshot: 30,
        vendorEarnings: null,
        product: { id: 'prod_b1', name: 'Vendor B Gadget', costPrice: 30 },
        productVariant: null,
      },
    ],
  },
]

const REFUNDS: FakeRefund[] = [
  {
    id: 'refund_1',
    orderId: 'order_a1',
    amount: 12.5,
    status: 'PROCESSED',
    createdAt: new Date('2026-10-12T00:00:00.000Z'),
  },
]

// Every request comes from its own address, so the rate limiter sees one
// caller per test instead of one caller for the whole file.
let requestCounter = 0

function buildRequest(
  query = 'from=2026-10-01&to=2026-10-31',
  withToken = true,
): NextRequest {
  requestCounter += 1
  return new NextRequest(`http://localhost/api/vendor/sales-summary?${query}`, {
    method: 'GET',
    headers: {
      ...(withToken ? { cookie: 'token=test-token' } : {}),
      'x-forwarded-for': `10.0.0.${requestCounter}`,
    },
  })
}

function useFakeDb(orders: FakeOrder[] = ORDERS) {
  const fake = createFakeSalesPrisma({
    store: { id: 'store_a', userId: 'vendor_a' },
    products: PRODUCTS,
    orders,
    refunds: REFUNDS,
  })

  prismaMock.store.findUnique.mockImplementation(fake.store.findUnique)
  prismaMock.product.count.mockImplementation(fake.product.count)
  prismaMock.order.count.mockImplementation(fake.order.count)
  prismaMock.order.findMany.mockImplementation(fake.order.findMany)
  prismaMock.order.findFirst.mockImplementation(fake.order.findFirst)
  prismaMock.order.aggregate.mockImplementation(fake.order.aggregate)
  prismaMock.refund.findMany.mockImplementation(fake.refund.findMany)

  return fake
}

beforeEach(() => {
  vi.clearAllMocks()
  clearSalesSummaryCache()
  verifyTokenMock.mockResolvedValue(VENDOR_A)
  isVendorOnboardedMock.mockResolvedValue(true)
  useFakeDb()
})

afterEach(() => {
  clearSalesSummaryCache()
})

describe('GET /api/vendor/sales-summary', () => {
  it('returns 401 when no token cookie is present', async () => {
    const response = await GET(buildRequest('from=2026-10-01&to=2026-10-31', false))
    expect(response.status).toBe(401)
  })

  it('returns 403 when the token is not authenticated', async () => {
    verifyTokenMock.mockResolvedValue({ authenticated: false, reason: 'invalid_token' })
    const response = await GET(buildRequest())
    expect(response.status).toBe(403)
  })

  it('returns 403 when the caller is not a vendor', async () => {
    verifyTokenMock.mockResolvedValue({ authenticated: true, userId: 'u1', role: 'CUSTOMER', sessionId: 's' })
    const response = await GET(buildRequest())
    expect(response.status).toBe(403)
  })

  it('returns 403 when the vendor is not onboarded', async () => {
    isVendorOnboardedMock.mockResolvedValue(false)
    const response = await GET(buildRequest())
    expect(response.status).toBe(403)
  })

  it('returns 404 when the vendor has no store', async () => {
    prismaMock.store.findUnique.mockResolvedValue(null)
    const response = await GET(buildRequest())
    expect(response.status).toBe(404)
  })

  it('rejects a malformed date', async () => {
    const response = await GET(buildRequest('from=nope&to=2026-10-31'))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/YYYY-MM-DD/)
  })

  it('rejects a date range longer than 366 days', async () => {
    const response = await GET(buildRequest('from=2024-01-01&to=2026-01-01'))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/366 days/)
  })

  it('rejects an unknown source', async () => {
    const response = await GET(buildRequest('from=2026-10-01&to=2026-10-31&source=SOMETHING'))
    expect(response.status).toBe(400)
  })

  it('returns the vendor money view for the period', async () => {
    const response = await GET(buildRequest())
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.range).toEqual({ from: '2026-10-01', to: '2026-10-31', days: 31 })
    expect(body.totals.revenue).toBe(40)
    expect(body.totals.cogs).toBe(10)
    expect(body.totals.deliveryCost).toBe(5)
    expect(body.totals.profit).toBe(25)
    expect(body.profitLabel).toBe('Profit before other expenses')
    expect(body.totals.orders).toBe(1)
    expect(body.totals.costCoveragePercent).toBe(100)
    expect(body.coverage.missingCostItems).toBe(0)
  })

  it('never shows another vendor their data', async () => {
    const response = await GET(buildRequest())
    const body = await response.json()

    // The query was scoped to this vendor's store.
    const orderCall = prismaMock.order.findMany.mock.calls[0][0] as any
    expect(orderCall.where.items.some.product.storeId).toBe('store_a')

    // Vendor B's order and product are nowhere in the answer.
    expect(JSON.stringify(body)).not.toContain('Vendor B Gadget')
    expect(JSON.stringify(body)).not.toContain('order_b1')
    expect(body.totals.revenue).toBe(40)
  })

  it('keeps each vendor inside their own store', async () => {
    verifyTokenMock.mockResolvedValue(VENDOR_B)
    useFakeDb()
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store_b', userId: 'vendor_b' })

    const response = await GET(buildRequest())
    const body = await response.json()

    const orderCall = prismaMock.order.findMany.mock.calls[0][0] as any
    expect(orderCall.where.items.some.product.storeId).toBe('store_b')
    expect(body.totals.revenue).toBe(80)
    expect(JSON.stringify(body)).not.toContain('Vendor A Widget')
  })

  it('splits online and manual revenue', async () => {
    const response = await GET(buildRequest())
    const body = await response.json()
    const manual = body.bySource.find((row: any) => row.key === 'MANUAL')
    const online = body.bySource.find((row: any) => row.key === 'ONLINE')
    expect(manual.revenue).toBe(40)
    expect(online.revenue).toBe(0)
  })

  it('filters by source', async () => {
    const response = await GET(buildRequest('from=2026-10-01&to=2026-10-31&source=ONLINE'))
    const body = await response.json()
    expect(body.totals.orders).toBe(0)
    expect(body.source).toBe('ONLINE')
  })

  it('reports refunds separately from revenue', async () => {
    const response = await GET(buildRequest())
    const body = await response.json()
    expect(body.refunds.amount).toBe(12.5)
    expect(body.refunds.count).toBe(1)
    expect(body.totals.revenue).toBe(40)
  })

  it('reports the receivables of all time, not just the period', async () => {
    useFakeDb([
      {
        ...ORDERS[0],
        id: 'order_old',
        createdAt: new Date('2025-01-05T12:00:00.000Z'),
        total: 75,
        paymentStatus: 'PENDING',
      },
    ])

    const response = await GET(buildRequest())
    const body = await response.json()

    // The order is outside the period, so it is not revenue, but the vendor
    // is still owed the money.
    expect(body.totals.orders).toBe(0)
    expect(body.totals.revenue).toBe(0)
    expect(body.receivables.count).toBe(1)
    expect(body.receivables.amount).toBe(75)
    expect(body.receivables.oldestAgeDays).toBeGreaterThan(300)
  })
})

describe('GET /api/vendor/sales-summary - memory and safety', () => {
  it('reads the orders in pages instead of one big query', async () => {
    const many: FakeOrder[] = Array.from({ length: 1200 }, (_, index) => ({
      ...ORDERS[0],
      id: `order_${String(index).padStart(4, '0')}`,
      createdAt: new Date(Date.UTC(2026, 9, 1 + (index % 28), 12)),
    }))
    useFakeDb(many)

    const response = await GET(buildRequest())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.totals.orders).toBe(1200)

    // 500 + 500 + 200, and never a query without a take.
    const findManyCalls = prismaMock.order.findMany.mock.calls as any[]
    expect(findManyCalls.length).toBeGreaterThan(1)
    for (const [args] of findManyCalls) {
      expect(args.take).toBe(500)
    }

    // The second page starts right after the last order of the first one, and
    // no order is read twice.
    const pages = prismaMock.order.findMany.mock.results.map((result: any) =>
      result.value as Promise<any[]>,
    )
    const rows = (await Promise.all(pages)).flat()
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)

    const firstPageRows = await pages[0]
    expect(findManyCalls[1][0].cursor).toEqual({ id: firstPageRows[firstPageRows.length - 1].id })
  })

  it('refuses a period that covers more than 50,000 orders', async () => {
    prismaMock.order.count.mockResolvedValue(50_001)

    const response = await GET(buildRequest())
    expect(response.status).toBe(413)
    const body = await response.json()
    expect(body.error).toMatch(/range too large, choose a shorter period/)
    expect(body.limit).toBe(50_000)
  })

  it('serves a period of exactly 50,000 orders', async () => {
    prismaMock.order.count.mockResolvedValue(50_000)
    const response = await GET(buildRequest())
    expect(response.status).toBe(200)
  })
})

describe('GET /api/vendor/sales-summary - the cache', () => {
  it('answers the second identical request from the cache', async () => {
    const first = await GET(buildRequest())
    expect(first.status).toBe(200)
    const callsAfterFirst = prismaMock.order.findMany.mock.calls.length

    const second = await GET(buildRequest())
    expect(second.status).toBe(200)
    const secondBody = await second.json()

    expect(prismaMock.order.findMany.mock.calls.length).toBe(callsAfterFirst)
    expect(secondBody.cached).toBe(true)
  })

  it('never shows one vendor the numbers of another', async () => {
    const first = await GET(buildRequest())
    const firstBody = await first.json()
    expect(firstBody.totals.revenue).toBe(40)

    // Vendor B asks for the same period. The cache key holds the store, so
    // vendor B gets their own report, not vendor A's.
    verifyTokenMock.mockResolvedValue(VENDOR_B)
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store_b', userId: 'vendor_b' })

    const second = await GET(buildRequest())
    const secondBody = await second.json()

    expect(secondBody.totals.revenue).toBe(80)
    expect(secondBody.cached).toBeUndefined()
    expect(salesSummaryCacheSize()).toBe(2)
  })

  it('keys the cache by the period and the source', async () => {
    await GET(buildRequest('from=2026-10-01&to=2026-10-31'))
    await GET(buildRequest('from=2026-10-01&to=2026-10-15'))
    await GET(buildRequest('from=2026-10-01&to=2026-10-31&source=MANUAL'))
    expect(salesSummaryCacheSize()).toBe(3)
  })
})
