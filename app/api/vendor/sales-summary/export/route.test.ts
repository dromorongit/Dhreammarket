import { describe, it, expect, vi, beforeEach } from 'vitest'
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

import { GET } from '@/app/api/vendor/sales-summary/export/route'
import {
  createFakeSalesPrisma,
  type FakeOrder,
  type FakeProduct,
} from '@/app/api/vendor/sales-summary/fake-sales-db.test-utils'

const VENDOR_A = {
  authenticated: true,
  userId: 'vendor_a',
  role: 'VENDOR',
  sessionId: 'sess_a',
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

function buildOrder(overrides: any = {}): FakeOrder {
  return {
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
    ...overrides,
  }
}

const ORDERS: FakeOrder[] = [
  buildOrder(),
  buildOrder({
    id: 'order_b1',
    total: 80,
    deliveryCost: null,
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
  }),
]

beforeEach(() => {
  vi.clearAllMocks()
  verifyTokenMock.mockResolvedValue(VENDOR_A)
  isVendorOnboardedMock.mockResolvedValue(true)

  const fake = createFakeSalesPrisma({
    store: { id: 'store_a', userId: 'vendor_a' },
    products: PRODUCTS,
    orders: ORDERS,
    refunds: [],
  })

  prismaMock.store.findUnique.mockImplementation(fake.store.findUnique)
  prismaMock.product.count.mockImplementation(fake.product.count)
  prismaMock.order.count.mockImplementation(fake.order.count)
  prismaMock.order.findMany.mockImplementation(fake.order.findMany)
  prismaMock.order.findFirst.mockImplementation(fake.order.findFirst)
  prismaMock.order.aggregate.mockImplementation(fake.order.aggregate)
  prismaMock.refund.findMany.mockImplementation(fake.refund.findMany)
})

// Every request comes from its own address, so the rate limiter sees one
// caller per test instead of one caller for the whole file.
let requestCounter = 0

function buildRequest(query = 'from=2026-10-01&to=2026-10-31', withToken = true): NextRequest {
  requestCounter += 1
  return new NextRequest(`http://localhost/api/vendor/sales-summary/export?${query}`, {
    method: 'GET',
    headers: {
      ...(withToken ? { cookie: 'token=test-token' } : {}),
      'x-forwarded-for': `10.0.0.${requestCounter}`,
    },
  })
}

describe('GET /api/vendor/sales-summary/export', () => {
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

  it('returns 404 when the vendor has no store', async () => {
    prismaMock.store.findUnique.mockResolvedValue(null)
    const response = await GET(buildRequest())
    expect(response.status).toBe(404)
  })

  it('rejects a malformed date', async () => {
    const response = await GET(buildRequest('from=nope&to=2026-10-31'))
    expect(response.status).toBe(400)
  })

  it('rejects a date range longer than 366 days', async () => {
    const response = await GET(buildRequest('from=2024-01-01&to=2026-01-01'))
    expect(response.status).toBe(400)
  })

  it('sends a CSV with a UTF-8 BOM and a download name', async () => {
    const response = await GET(buildRequest())
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain(
      'dhreamarket-sales-20261001-20261031.csv'
    )

    const bytes = new Uint8Array(await response.arrayBuffer())
    // EF BB BF is the UTF-8 byte order mark Excel needs.
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])

    const text = new TextDecoder('utf-8').decode(bytes.slice(3))
    expect(text.split('\r\n')[0]).toBe(
      'date,order number,channel,customer name,items,revenue,cost,delivery cost,profit,payment status,payment method',
    )
  })

  it('writes one row per order with its money', async () => {
    const response = await GET(buildRequest())
    const bytes = new Uint8Array(await response.arrayBuffer())
    const text = new TextDecoder('utf-8').decode(bytes.slice(3))
    const lines = text.trim().split('\r\n')

    expect(lines).toHaveLength(2)
    const cells = lines[1].split(',')
    expect(cells[0]).toBe('2026-10-10')
    expect(cells[1]).toBe('ORDER_A1')
    expect(cells[2]).toBe('WHATSAPP')
    expect(cells[3]).toBe('Kofi Mensah')
    expect(cells[4]).toBe('2 x Vendor A Widget')
    expect(cells[5]).toBe('40')
    expect(cells[6]).toBe('10')
    expect(cells[7]).toBe('5')
    expect(cells[8]).toBe('25')
    expect(cells[9]).toBe('PAID')
    expect(cells[10]).toBe('CASH')
  })

  it('never exports another vendor\'s data', async () => {
    const response = await GET(buildRequest())
    const text = await response.text()
    expect(text).not.toContain('Vendor B Gadget')
    expect(text).not.toContain('ORDER_B1')
  })

  it('escapes a customer name that would become a spreadsheet formula', async () => {
    prismaMock.order.findMany.mockImplementation(async () => [
      buildOrder({
        customerFirstName: '=cmd|calc',
        customerLastName: null,
      }),
    ])

    const response = await GET(buildRequest())
    const text = await response.text()
    expect(text).toContain("'=cmd|calc")
    expect(text).not.toContain(',=cmd|calc')
  })

  it('refuses a period that covers more than 50,000 orders', async () => {
    prismaMock.order.count.mockResolvedValue(50_001)

    const response = await GET(buildRequest())
    expect(response.status).toBe(413)
    const body = await response.json()
    expect(body.error).toMatch(/range too large, choose a shorter period/)
    expect(body.limit).toBe(50_000)
  })

  it('streams the rows instead of building one string', async () => {
    const response = await GET(buildRequest())
    expect(response.body).toBeInstanceOf(ReadableStream)

    // The body is a stream, so the file is written as the rows arrive.
    const reader = (response.body as ReadableStream<Uint8Array>).getReader()
    const chunks: Uint8Array[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    expect(chunks.length).toBeGreaterThan(1)
  })
})
