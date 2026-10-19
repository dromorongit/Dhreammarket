import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { buildSalesSummary } from '@/lib/sales-summary'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  product: { findMany: vi.fn() },
  order: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  orderItem: { createMany: vi.fn() },
  vendorCustomer: { upsert: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

const rateLimitMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/rate-limit', () => ({ rateLimit: rateLimitMock }))

const createAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: createAuditLogMock }))

const consumeManualSaleStockMock = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }))
vi.mock('@/lib/stock-reservation', () => ({
  consumeManualSaleStock: consumeManualSaleStockMock,
}))

import { POST } from '@/app/api/vendor/manual-orders/route'

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_v',
}

const BASE_BODY: any = {
  customer: { name: 'Kofi Mensah', phone: '0242222222', email: 'kofi@example.com' },
  channel: 'WHATSAPP',
  items: [{ productId: 'prod_1', quantity: 2 }],
  deliveryFee: 0,
  markPaid: false,
  idempotencyKey: 'key_1',
}

function buildRequest(body: unknown, withToken = true): NextRequest {
  return new NextRequest('http://localhost/api/vendor/manual-orders', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(withToken ? { cookie: 'token=test-token' } : {}),
    },
    body: JSON.stringify(body),
  })
}

/** The product the vendor is selling, with the cost prices the test sets up. */
let productList: any[] = []

function mockTx() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    order: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({
        id: 'order_1',
        receiptToken: 'ab12cd34ef56gh78ij90kl12mn34op56qr',
        status: 'PROCESSING',
        paymentStatus: 'PENDING',
        paymentMethod: null,
        subtotal: data.subtotal,
        shipping: data.shipping,
        total: data.total,
        deliveryCost: data.deliveryCost,
        customerFirstName: 'Kofi',
        customerPhone: '+233242222222',
        customerEmail: 'kofi@example.com',
        items: [],
      })),
      update: vi.fn().mockResolvedValue({}),
    },
    orderItem: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    vendorCustomer: {
      upsert: vi.fn().mockResolvedValue({ id: 'vc_1', storeId: 'store_1', phone: '+233242222222' }),
    },
  }
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx))
  return tx
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyTokenMock.mockResolvedValue(VENDOR)
  isVendorOnboardedMock.mockResolvedValue(true)
  prismaMock.store.findUnique.mockResolvedValue({ id: 'store_1', userId: 'vendor_1' })
  rateLimitMock.mockReturnValue(() => ({ success: true }))
  productList = [
    {
      id: 'prod_1',
      storeId: 'store_1',
      name: 'Widget',
      price: 10,
      costPrice: 4,
      dealsPrice: null,
      salesPrice: null,
      availabilityType: 'IN_STOCK',
      variants: [{ id: 'var_1', productId: 'prod_1', price: null, costPrice: 6 }],
    },
  ]
  prismaMock.product.findMany.mockImplementation(async () => productList)
  mockTx()
})

describe('POST /api/vendor/manual-orders cost snapshots', () => {
  it('writes the variant cost as the sale-time snapshot', async () => {
    const tx = mockTx()
    const response = await POST(
      buildRequest({
        ...BASE_BODY,
        items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 2 }],
      })
    )
    expect(response.status).toBe(201)

    const call = tx.orderItem.createMany.mock.calls[0][0] as any
    expect(call.data[0].costPriceSnapshot).toBe(6)
  })

  it('falls back to the product cost when the variant has none', async () => {
    productList[0].variants[0].costPrice = null
    const tx = mockTx()
    const response = await POST(
      buildRequest({
        ...BASE_BODY,
        items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 2 }],
      })
    )
    expect(response.status).toBe(201)

    const call = tx.orderItem.createMany.mock.calls[0][0] as any
    expect(call.data[0].costPriceSnapshot).toBe(4)
  })

  it('writes a null snapshot when the product has no cost at all', async () => {
    productList[0].costPrice = null
    productList[0].variants[0].costPrice = null
    const tx = mockTx()
    const response = await POST(
      buildRequest({
        ...BASE_BODY,
        items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 2 }],
      })
    )
    expect(response.status).toBe(201)

    const call = tx.orderItem.createMany.mock.calls[0][0] as any
    expect(call.data[0].costPriceSnapshot).toBeNull()
  })

  it('stores the delivery cost the vendor paid the rider', async () => {
    const tx = mockTx()
    const response = await POST(buildRequest({ ...BASE_BODY, deliveryCost: 7.5 }))
    expect(response.status).toBe(201)

    const create = tx.order.create.mock.calls[0][0] as any
    expect(create.data.deliveryCost).toBe(7.5)
  })

  it('leaves the delivery cost null when the vendor does not say', async () => {
    const tx = mockTx()
    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(201)

    const create = tx.order.create.mock.calls[0][0] as any
    expect(create.data.deliveryCost).toBeNull()
  })

  it('rejects a negative delivery cost', async () => {
    const response = await POST(buildRequest({ ...BASE_BODY, deliveryCost: -1 }))
    expect(response.status).toBe(400)
  })

  it('keeps the profit of a past sale when the vendor edits the cost later', async () => {
    const tx = mockTx()
    await POST(
      buildRequest({
        ...BASE_BODY,
        items: [{ productId: 'prod_1', variantId: 'var_1', quantity: 2 }],
        deliveryCost: 3,
      })
    )

    const created = tx.orderItem.createMany.mock.calls[0][0] as any
    const snapshot = created.data[0].costPriceSnapshot

    // The vendor edits the cost of the product and its variant.
    productList[0].costPrice = 40
    productList[0].variants[0].costPrice = 50

    const summary = buildSalesSummary({
      orders: [
        {
          id: 'order_1',
          source: 'MANUAL',
          channel: 'WHATSAPP',
          status: 'PROCESSING',
          paymentStatus: 'PAID',
          createdAt: new Date('2026-10-10T12:00:00.000Z'),
          total: 20,
          vendorEarnings: null,
          netAmount: null,
          deliveryCost: 3,
          items: [
            {
              id: 'item_1',
              productId: 'prod_1',
              productVariantId: 'var_1',
              productName: 'Widget',
              variantLabel: 'Red',
              quantity: 2,
              price: 10,
              costPriceSnapshot: snapshot,
              variantCostPrice: 50,
              productCostPrice: 40,
              vendorEarnings: null,
            },
          ],
        },
      ],
      refunds: [],
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-31T00:00:00.000Z'),
      now: new Date('2026-10-20T00:00:00.000Z'),
      source: 'ALL',
      missingCostProducts: 0,
    })

    // The snapshot wins: 20 revenue - 12 cost - 3 delivery = 5.
    expect(snapshot).toBe(6)
    expect(summary.totals.cogs).toBe(12)
    expect(summary.totals.profit).toBe(5)
  })
})
