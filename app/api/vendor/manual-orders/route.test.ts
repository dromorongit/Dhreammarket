import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

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

const consumeManualSaleStockMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true })
)
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

function mockAuth(authenticated = true) {
  verifyTokenMock.mockResolvedValue(
    authenticated
      ? VENDOR
      : { authenticated: false, reason: 'invalid_token' }
  )
}

function mockOnboarded(value = true) {
  isVendorOnboardedMock.mockResolvedValue(value)
}

function mockStore(value: any = { id: 'store_1', userId: 'vendor_1', name: 'Fake Store' }) {
  prismaMock.store.findUnique.mockResolvedValue(value)
}

function mockRateLimit(success = true) {
  rateLimitMock.mockReturnValue(() =>
    success
      ? { success: true }
      : { success: false, response: NextResponse.json({ error: 'Too many requests' }, { status: 429 }) }
  )
}

const productList = [
  {
    id: 'prod_1',
    storeId: 'store_1',
    name: 'Widget',
    price: 10,
    dealsPrice: null,
    salesPrice: null,
    availabilityType: 'IN_STOCK',
    variants: [{ id: 'var_1', productId: 'prod_1', price: null }],
  },
]

function mockTx(defaults: any = {}) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    order: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'order_1',
        receiptToken: 'ab12cd34ef56gh78ij90kl12mn34op56qr',
        status: 'PROCESSING',
        paymentStatus: 'PENDING',
        paymentMethod: null,
        subtotal: 20,
        shipping: 0,
        total: 20,
        customerFirstName: 'Kofi',
        customerPhone: '+233242222222',
        customerEmail: 'kofi@example.com',
        items: [],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    orderItem: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    vendorCustomer: { upsert: vi.fn().mockResolvedValue({ id: 'vc_1', storeId: 'store_1', phone: '+233242222222' }) },
    ...defaults,
  }
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx))
  return tx
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth()
  mockOnboarded()
  mockStore()
  mockRateLimit()
  prismaMock.product.findMany.mockResolvedValue(productList)
  mockTx()
})

describe('POST /api/vendor/manual-orders', () => {
  it('returns 401 when no token cookie is present', async () => {
    const response = await POST(buildRequest(BASE_BODY, false))
    expect(response.status).toBe(401)
  })

  it('returns 403 when the token is not authenticated', async () => {
    mockAuth(false)
    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(403)
  })

  it('returns 403 when the vendor is not onboarded', async () => {
    mockOnboarded(false)
    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(403)
  })

  it('returns 404 when the vendor has no store', async () => {
    mockStore(null)
    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    mockRateLimit(false)
    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(429)
  })

  it('rejects missing required fields', async () => {
    const response = await POST(buildRequest({}))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBeDefined()
  })

  it('rejects an invalid customer phone', async () => {
    const response = await POST(buildRequest({ ...BASE_BODY, customer: { name: 'Kofi', phone: '123' } }))
    expect(response.status).toBe(400)
  })

  it('rejects invalid quantities and unit prices', async () => {
    let response = await POST(buildRequest({ ...BASE_BODY, items: [{ productId: 'prod_1', quantity: 0 }] }))
    expect(response.status).toBe(400)

    response = await POST(buildRequest({ ...BASE_BODY, items: [{ productId: 'prod_1', quantity: 2, unitPrice: 1.234 }] }))
    expect(response.status).toBe(400)
  })

  it('rejects missing paymentMethod when markPaid is true', async () => {
    const response = await POST(buildRequest({ ...BASE_BODY, markPaid: true }))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('paymentMethod')
  })

  it('rejects unknown products', async () => {
    prismaMock.product.findMany.mockResolvedValue([])
    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(404)
  })

  it('rejects products from another store', async () => {
    prismaMock.product.findMany.mockResolvedValue([{ ...productList[0], storeId: 'store_2' }])
    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(403)
  })

  it('rejects non-IN_STOCK products', async () => {
    prismaMock.product.findMany.mockResolvedValue([{ ...productList[0], availabilityType: 'PREORDER' }])
    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(400)
  })

  it('rejects variants that do not belong to the product', async () => {
    const response = await POST(buildRequest({ ...BASE_BODY, items: [{ productId: 'prod_1', variantId: 'var_other', quantity: 1 }] }))
    expect(response.status).toBe(400)
  })

  it('creates an unpaid manual order with null money fields', async () => {
    const tx = mockTx()
    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(201)

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: null,
          source: 'MANUAL',
          channel: 'WHATSAPP',
          status: 'PROCESSING',
          fulfillmentStatus: 'PROCESSING',
          paymentStatus: 'PENDING',
          paymentMethod: null,
          paymentConfirmedAt: null,
          grossAmount: null,
          processorFee: null,
          netAmount: null,
          platformCommission: null,
          vendorEarnings: null,
          commissionRate: null,
          walletAmountApplied: null,
          orderType: 'NORMAL',
          idempotencyKey: 'key_1',
        }),
      })
    )

    expect(tx.vendorCustomer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId_phone: { storeId: 'store_1', phone: '+233242222222' } },
        create: expect.objectContaining({ phone: '+233242222222', firstChannel: 'WHATSAPP' }),
      })
    )

    expect(tx.orderItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ productId: 'prod_1', quantity: 2, price: 10, grossAmount: null, vendorEarnings: null }),
        ]),
      })
    )

    expect(consumeManualSaleStockMock).toHaveBeenCalledWith(
      tx,
      [{ productId: 'prod_1', productVariantId: undefined, quantity: 2 }],
      'order_1'
    )

    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MANUAL_ORDER_CREATED',
        entityType: 'ORDER',
        entityId: 'order_1',
        afterData: expect.objectContaining({ source: 'MANUAL', paymentStatus: 'PENDING', priceOverridden: false }),
      })
    )

    const body = await response.json()
    expect(body.order.id).toBe('order_1')
    expect(body.order.displayNumber).toBe('ORDER_1')
    expect(body.order.receiptToken).toBe('ab12cd34ef56gh78ij90kl12mn34op56qr')
    expect(body.order.receiptUrl).toContain('/receipt/ab12cd34ef56gh78ij90kl12mn34op56qr')
    expect(body.order.paymentStatus).toBe('PENDING')
    expect(body.order.subtotal).toBe(20)
    expect(body.order.total).toBe(20)
  })

  it('creates a paid manual order when markPaid is true', async () => {
    const tx = mockTx()
    tx.order.create.mockResolvedValueOnce({
      id: 'order_1',
      receiptToken: 'ab12cd34ef56gh78ij90kl12mn34op56qr',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      paymentMethod: 'MOBILE_MONEY',
      paymentConfirmedAt: new Date(),
      subtotal: 20,
      shipping: 0,
      total: 20,
      customerFirstName: 'Kofi',
      customerPhone: '+233242222222',
      customerEmail: 'kofi@example.com',
      items: [],
    })
    const response = await POST(buildRequest({ ...BASE_BODY, markPaid: true, paymentMethod: 'MOBILE_MONEY' }))
    expect(response.status).toBe(201)

    const createCall = tx.order.create.mock.calls[0]?.[0]
    expect(createCall.data.paymentStatus).toBe('PAID')
    expect(createCall.data.paymentMethod).toBe('MOBILE_MONEY')
    expect(createCall.data.paymentConfirmedAt).toBeInstanceOf(Date)

    const body = await response.json()
    expect(body.order.paymentStatus).toBe('PAID')
    expect(body.order.paymentMethod).toBe('MOBILE_MONEY')
  })

  it('applies the delivery fee to the total', async () => {
    const tx = mockTx()
    await POST(buildRequest({ ...BASE_BODY, deliveryFee: 5.5 }))
    const createCall = tx.order.create.mock.calls[0]?.[0]
    expect(createCall.data.shipping).toBe(5.5)
    expect(createCall.data.subtotal).toBe(20)
    expect(createCall.data.total).toBe(25.5)
  })

  it('snapshots a vendor price override and audits it', async () => {
    const tx = mockTx()
    await POST(buildRequest({ ...BASE_BODY, items: [{ productId: 'prod_1', quantity: 1, unitPrice: 15 }] }))
    const createCall = tx.orderItem.createMany.mock.calls[0]?.[0]
    expect(createCall.data[0].price).toBe(15)

    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MANUAL_ORDER_PRICE_OVERRIDDEN',
        entityType: 'ORDER',
        afterData: expect.objectContaining({
          overrides: expect.arrayContaining([
            expect.objectContaining({ productId: 'prod_1', unitPricePesewas: 1500, cataloguePricePesewas: 1000 }),
          ]),
        }),
      })
    )
  })

  it('ignores client-sent totals', async () => {
    const tx = mockTx()
    await POST(buildRequest({ ...BASE_BODY, total: 999999, subtotal: 1, shipping: 1 }))
    const createCall = tx.order.create.mock.calls[0]?.[0]
    expect(createCall.data.total).not.toBe(999999)
    expect(createCall.data.subtotal).toBe(20)
  })

  it('returns the existing order for a repeated idempotency key', async () => {
    const tx = mockTx()
    const existingOrder = {
      id: 'order_existing',
      receiptToken: 'existing-token',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      paymentMethod: 'MOBILE_MONEY',
      channel: 'WHATSAPP',
      subtotal: 50,
      shipping: 0,
      total: 50,
      customerFirstName: 'Kofi',
      customerPhone: '+233242222222',
      customerEmail: 'kofi@example.com',
      items: [{ product: { storeId: 'store_1' } }],
    }
    tx.order.findFirst.mockResolvedValue(existingOrder)

    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.order.id).toBe('order_existing')
    expect(body.order.receiptToken).toBe('existing-token')
    expect(tx.order.create).not.toHaveBeenCalled()
    expect(consumeManualSaleStockMock).not.toHaveBeenCalled()
  })

  it('conflicts when the idempotency key belongs to another store', async () => {
    const tx = mockTx()
    tx.order.findFirst.mockResolvedValue({
      items: [{ product: { storeId: 'store_2' } }],
    })
    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(409)
    expect(tx.order.create).not.toHaveBeenCalled()
  })

  it('returns 409 with product names when stock is insufficient', async () => {
    consumeManualSaleStockMock.mockResolvedValue({
      success: false,
      error: 'Insufficient stock for product prod_1',
    })
    const response = await POST(buildRequest(BASE_BODY))
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toContain('Insufficient stock')
    expect(Array.isArray(body.products)).toBe(true)
    expect(body.products[0].productName).toBe('Widget')
  })

  it('creates one order and consumes stock once for the same key used concurrently', async () => {
    let gate = Promise.resolve()
    const releases: (() => void)[] = []
    let createdOrder: any = null

    function makeTx() {
      return {
        $queryRaw: vi.fn().mockResolvedValue([]),
        order: {
          findFirst: vi.fn().mockResolvedValue(createdOrder),
          create: vi.fn().mockImplementation((args: any) => {
            createdOrder = { id: 'order_concurrent', receiptToken: 'tok-concurrent', ...args.data, items: [{ product: { storeId: 'store_1' } }] }
            return createdOrder
          }),
          update: vi.fn(),
        },
        orderItem: { createMany: vi.fn() },
        vendorCustomer: { upsert: vi.fn().mockResolvedValue({ id: 'vc_1', storeId: 'store_1', phone: '+233242222222' }) },
      }
    }

    // Serialize $transaction callbacks (FIFO) to simulate advisory-lock serialization.
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const waitForPrevious = gate
      const proceed = new Promise<void>((resolve) => releases.push(resolve))
      gate = proceed
      try {
        const result = await waitForPrevious.then(() => cb(makeTx()))
        releases.shift()?.()
        return result
      } finally {
        releases.shift()?.()
      }
    })

    consumeManualSaleStockMock.mockResolvedValue({ success: true })

    const [r1, r2] = await Promise.all([
      POST(buildRequest(BASE_BODY)),
      POST(buildRequest({ ...BASE_BODY, idempotencyKey: 'key_1' })),
    ])

    expect(r1.status).toBe(201)
    expect(r2.status).toBe(200)
    expect((await r1.json()).order.id).toBe('order_concurrent')
    expect((await r2.json()).order.id).toBe('order_concurrent')
    expect(consumeManualSaleStockMock).toHaveBeenCalledTimes(1)
  })

  it('maps phone formats to a single customer upsert key', async () => {
    const tx = mockTx()
    await POST(buildRequest({ ...BASE_BODY, customer: { name: 'A', phone: '0242222222' } }))
    await POST(buildRequest({ ...BASE_BODY, idempotencyKey: 'key_2', customer: { name: 'A', phone: '+233242222222' } }))
    await POST(buildRequest({ ...BASE_BODY, idempotencyKey: 'key_3', customer: { name: 'A', phone: '233242222222' } }))

    expect(tx.vendorCustomer.upsert).toHaveBeenCalledTimes(3)
    for (const call of tx.vendorCustomer.upsert.mock.calls) {
      expect(call[0].where.storeId_phone.phone).toBe('+233242222222')
      expect(call[0].where.storeId_phone.storeId).toBe('store_1')
    }
  })
})

