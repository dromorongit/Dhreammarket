import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  order: { findFirst: vi.fn(), update: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

const restoreManualSaleStockMock = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }))
vi.mock('@/lib/stock-reservation', () => ({ restoreManualSaleStock: restoreManualSaleStockMock }))

const stampOrderItemsMock = vi.hoisted(() => vi.fn().mockResolvedValue(1))
vi.mock('@/lib/order-delivery-stamps', () => ({ stampOrderItems: stampOrderItemsMock }))

const createAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: createAuditLogMock }))

import { PATCH } from '@/app/api/vendor/manual-orders/[orderId]/status/route'

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_v',
}

const PARAMS = { params: { orderId: 'order_1' } }

function buildRequest(body: unknown, withToken = true): NextRequest {
  return new NextRequest('http://localhost/api/vendor/manual-orders/order_1/status', {
    method: 'PATCH',
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

function mockOrder(order: any) {
  prismaMock.order.findFirst.mockResolvedValue(order)
}

function mockTx() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    order: { update: vi.fn().mockResolvedValue({ id: 'order_1', status: 'SHIPPED' }) },
  }
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx))
  return tx
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth()
  mockOnboarded()
  mockStore()
  mockOrder({
    id: 'order_1',
    source: 'MANUAL',
    status: 'PROCESSING',
    fulfillmentStatus: 'PROCESSING',
    paymentStatus: 'PENDING',
    receiptToken: 'tok_1',
    inventoryConsumedAt: new Date(),
    total: 25,
  })
  mockTx()
})

describe('PATCH /api/vendor/manual-orders/[orderId]/status', () => {
  it('returns 401 when no token cookie is present', async () => {
    const response = await PATCH(buildRequest({ status: 'SHIPPED' }, false), PARAMS)
    expect(response.status).toBe(401)
  })

  it('returns 403 when the vendor is not onboarded', async () => {
    mockOnboarded(false)
    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)
    expect(response.status).toBe(403)
  })

  it('returns 404 when the order is not the vendorâ€™s manual order', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null)
    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)
    expect(response.status).toBe(404)
  })

  it('rejects updating an ONLINE order with 409', async () => {
    mockOrder({ id: 'order_1', source: 'ONLINE', status: 'PROCESSING' })
    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)
    expect(response.status).toBe(409)
  })

  it('rejects missing or invalid status', async () => {
    let response = await PATCH(buildRequest({}), PARAMS)
    expect(response.status).toBe(400)

    response = await PATCH(buildRequest({ status: 'PENDING' }), PARAMS)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('allowed next steps')

    response = await PATCH(buildRequest({ status: 'BOGUS' }), PARAMS)
    expect(response.status).toBe(400)
  })

  it('allows PROCESSING -> SHIPPED even when unpaid, and stamps shippedAt', async () => {
    mockOrder({ id: 'order_1', source: 'MANUAL', status: 'PROCESSING', fulfillmentStatus: 'PROCESSING', paymentStatus: 'PENDING' })
    const tx = mockTx()
    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)
    expect(response.status).toBe(200)
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'SHIPPED', fulfillmentStatus: 'SHIPPED' },
    })
    expect(stampOrderItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order_1', storeId: 'store_1', field: 'shippedAt', now: expect.any(Date) })
    )
  })

  it('allows SHIPPED -> DELIVERED and stamps deliveredAt', async () => {
    mockOrder({ id: 'order_1', source: 'MANUAL', status: 'SHIPPED', fulfillmentStatus: 'SHIPPED', paymentStatus: 'PENDING' })
    const tx = mockTx()
    const response = await PATCH(buildRequest({ status: 'DELIVERED' }), PARAMS)
    expect(response.status).toBe(200)
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'DELIVERED', fulfillmentStatus: 'DELIVERED' },
    })
    expect(stampOrderItemsMock).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'deliveredAt' })
    )
  })

  it('allows DELIVERED -> COMPLETED without stamping again', async () => {
    mockOrder({ id: 'order_1', source: 'MANUAL', status: 'DELIVERED', fulfillmentStatus: 'DELIVERED', paymentStatus: 'PAID' })
    const tx = mockTx()
    const response = await PATCH(buildRequest({ status: 'COMPLETED' }), PARAMS)
    expect(response.status).toBe(200)
    expect(stampOrderItemsMock).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it('refuses COMPLETED -> any further transition', async () => {
    mockOrder({ id: 'order_1', source: 'MANUAL', status: 'COMPLETED', fulfillmentStatus: 'DELIVERED' })
    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)
    expect(response.status).toBe(400)
  })

  it('allows PROCESSING -> CANCELLED and restores stock atomically', async () => {
    mockOrder({ id: 'order_1', source: 'MANUAL', status: 'PROCESSING', fulfillmentStatus: 'PROCESSING', paymentStatus: 'PAID', inventoryConsumedAt: new Date() })
    const tx = mockTx()
    const response = await PATCH(buildRequest({ status: 'CANCELLED' }), PARAMS)
    expect(response.status).toBe(200)

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(String(tx.$queryRaw.mock.calls[0][0])).toContain('FOR UPDATE')
    expect(restoreManualSaleStockMock).toHaveBeenCalledWith(tx, 'order_1')
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'CANCELLED', fulfillmentStatus: 'CANCELLED' },
    })

    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ORDER_CANCELLED', entityType: 'ORDER' })
    )

    const body = await response.json()
    expect(body.order.status).toBe('CANCELLED')
    expect(body.order.paymentStatus).toBe('PAID')
  })

  it('allows SHIPPED -> CANCELLED and restores stock exactly once', async () => {
    mockOrder({ id: 'order_1', source: 'MANUAL', status: 'SHIPPED', fulfillmentStatus: 'SHIPPED', paymentStatus: 'PENDING', inventoryConsumedAt: new Date() })
    mockTx()
    const response = await PATCH(buildRequest({ status: 'CANCELLED' }), PARAMS)
    expect(response.status).toBe(200)
    expect(restoreManualSaleStockMock).toHaveBeenCalledTimes(1)
  })

  it('refuses cancelling DELIVERED with 409', async () => {
    mockOrder({ id: 'order_1', source: 'MANUAL', status: 'DELIVERED', fulfillmentStatus: 'DELIVERED', paymentStatus: 'PAID' })
    const response = await PATCH(buildRequest({ status: 'CANCELLED' }), PARAMS)
    expect(response.status).toBe(409)
    expect(restoreManualSaleStockMock).not.toHaveBeenCalled()
  })

  it('refuses cancelling COMPLETED with 409', async () => {
    mockOrder({ id: 'order_1', source: 'MANUAL', status: 'COMPLETED', fulfillmentStatus: 'DELIVERED' })
    const response = await PATCH(buildRequest({ status: 'CANCELLED' }), PARAMS)
    expect(response.status).toBe(409)
  })

  it('restores stock exactly once under concurrent cancels', async () => {
    const order = { id: 'order_1', source: 'MANUAL', status: 'PROCESSING', inventoryConsumedAt: new Date() }
    let gate = Promise.resolve()
    const releases: (() => void)[] = []

    function makeTx() {
      return {
        $queryRaw: vi.fn().mockResolvedValue([]),
        order: {
          update: vi.fn().mockResolvedValue({ id: 'order_1' }),
          findFirst: vi.fn(),
        },
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

    restoreManualSaleStockMock.mockResolvedValue({ success: true })

    const [r1, r2] = await Promise.all([
      PATCH(buildRequest({ status: 'CANCELLED' }), PARAMS),
      PATCH(buildRequest({ status: 'CANCELLED' }), PARAMS),
    ])

    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    expect(restoreManualSaleStockMock).toHaveBeenCalledTimes(2)
  })

  it('returns 403 when the token is not authenticated', async () => {
    mockAuth(false)
    const response = await PATCH(buildRequest({ status: 'SHIPPED' }), PARAMS)
    expect(response.status).toBe(403)
  })
})

