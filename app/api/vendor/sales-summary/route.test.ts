import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  product: { findMany: vi.fn() },
  order: { findMany: vi.fn() },
  refund: { findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

import { GET } from '@/app/api/vendor/sales-summary/route'

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

const PRODUCTS = [
  {
    id: 'prod_a1',
    name: 'Vendor A Widget',
    price: 20,
    costPrice: 5,
    variants: [{ id: 'var_a1', color: 'Red', size: null, age: null, sku: null, price: null, costPrice: null }],
  },
  {
    id: 'prod_b1',
    name: 'Vendor B Gadget',
    price: 80,
    costPrice: 30,
    variants: [],
  },
]

const ORDERS = [
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
    user: null,
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
    user: null,
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

function inRange(date: Date, from: Date, to: Date) {
  return date.getTime() >= from.getTime() && date.getTime() < to.getTime()
}

const PRODUCT_STORE: Record<string, string> = { prod_a1: 'store_a', prod_b1: 'store_b' }

beforeEach(() => {
  vi.clearAllMocks()
  verifyTokenMock.mockResolvedValue(VENDOR_A)
  isVendorOnboardedMock.mockResolvedValue(true)
  prismaMock.store.findUnique.mockResolvedValue({ id: 'store_a', userId: 'vendor_a' })

  // A tiny prisma that honours the where clauses the route relies on.
  prismaMock.product.findMany.mockImplementation(async ({ where }: any) =>
    PRODUCTS.filter((p) => PRODUCT_STORE[p.id] === where.storeId).map((p) => ({
      ...p,
      storeId: PRODUCT_STORE[p.id],
    })),
  )

  prismaMock.order.findMany.mockImplementation(async ({ where }: any) => {
    const allowed = where?.items?.some?.productId?.in ?? []
    return ORDERS.filter(
      (order) =>
        order.deletedAt === null &&
        order.items.some((item) => allowed.includes(item.productId)) &&
        inRange(order.createdAt, where.createdAt.gte, where.createdAt.lt)
    )
  })

  prismaMock.refund.findMany.mockImplementation(async ({ where }: any) => {
    const allowed = where?.order?.items?.some?.productId?.in ?? []
    const matching = ORDERS.filter(
      (order) =>
        order.deletedAt === null &&
        order.items.some((item) => allowed.includes(item.productId)) &&
        inRange(order.createdAt, where.order.createdAt.gte, where.order.createdAt.lt)
    )
    if (matching.length === 0) return []
    return [
      {
        id: 'refund_1',
        orderId: matching[0].id,
        amount: 12.5,
        status: 'PROCESSED',
        createdAt: new Date('2026-10-12T00:00:00.000Z'),
      },
    ]
  })
})

function buildRequest(query = 'from=2026-10-01&to=2026-10-31', withToken = true): NextRequest {
  return new NextRequest(`http://localhost/api/vendor/sales-summary?${query}`, {
    method: 'GET',
    headers: withToken ? { cookie: 'token=test-token' } : {},
  })
}

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

    // The query was scoped to this vendor's store and their product ids.
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'store_a' } })
    )
    const orderCall = prismaMock.order.findMany.mock.calls[0][0] as any
    expect(orderCall.where.items.some.productId.in).toEqual(['prod_a1'])

    // Vendor B's order and product are nowhere in the answer.
    expect(JSON.stringify(body)).not.toContain('Vendor B Gadget')
    expect(JSON.stringify(body)).not.toContain('order_b1')
    expect(body.totals.revenue).toBe(40)
  })

  it('keeps each vendor inside their own store', async () => {
    verifyTokenMock.mockResolvedValue(VENDOR_B)
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store_b', userId: 'vendor_b' })

    const response = await GET(buildRequest())
    const body = await response.json()

    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'store_b' } })
    )
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
})
