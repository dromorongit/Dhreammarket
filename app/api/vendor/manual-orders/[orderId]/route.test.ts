import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  order: { findFirst: vi.fn(), update: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

const createAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: createAuditLogMock }))

import { PATCH } from '@/app/api/vendor/manual-orders/[orderId]/route'

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_v',
}

function buildRequest(body: unknown, withToken = true): NextRequest {
  return new NextRequest('http://localhost/api/vendor/manual-orders/order_1', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(withToken ? { cookie: 'token=test-token' } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyTokenMock.mockResolvedValue(VENDOR)
  isVendorOnboardedMock.mockResolvedValue(true)
  prismaMock.store.findUnique.mockResolvedValue({ id: 'store_1', userId: 'vendor_1' })
  prismaMock.order.findFirst.mockResolvedValue({
    id: 'order_1',
    source: 'MANUAL',
    status: 'PROCESSING',
    paymentStatus: 'PENDING',
    deliveryCost: null,
    total: 40,
  })
  prismaMock.order.update.mockResolvedValue({
    id: 'order_1',
    status: 'PROCESSING',
    paymentStatus: 'PENDING',
    deliveryCost: 7.5,
    total: 40,
  })
})

describe('PATCH /api/vendor/manual-orders/[orderId]', () => {
  it('returns 401 when no token cookie is present', async () => {
    const response = await PATCH(buildRequest({ deliveryCost: 5 }, false), {
      params: { orderId: 'order_1' },
    })
    expect(response.status).toBe(401)
  })

  it('returns 403 when the token is not authenticated', async () => {
    verifyTokenMock.mockResolvedValue({ authenticated: false, reason: 'invalid_token' })
    const response = await PATCH(buildRequest({ deliveryCost: 5 }), {
      params: { orderId: 'order_1' },
    })
    expect(response.status).toBe(403)
  })

  it('returns 403 when the vendor is not onboarded', async () => {
    isVendorOnboardedMock.mockResolvedValue(false)
    const response = await PATCH(buildRequest({ deliveryCost: 5 }), {
      params: { orderId: 'order_1' },
    })
    expect(response.status).toBe(403)
  })

  it('returns 404 when the vendor has no store', async () => {
    prismaMock.store.findUnique.mockResolvedValue(null)
    const response = await PATCH(buildRequest({ deliveryCost: 5 }), {
      params: { orderId: 'order_1' },
    })
    expect(response.status).toBe(404)
  })

  it('returns 404 when the order is not in the vendor\'s store', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null)
    const response = await PATCH(buildRequest({ deliveryCost: 5 }), {
      params: { orderId: 'order_1' },
    })
    expect(response.status).toBe(404)

    // The lookup was scoped to this vendor's store.
    const lookup = prismaMock.order.findFirst.mock.calls[0][0] as any
    expect(lookup.where.items.some.product.storeId).toBe('store_1')
  })

  it('refuses to touch an online order', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'order_1',
      source: 'ONLINE',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      deliveryCost: null,
      total: 40,
    })
    const response = await PATCH(buildRequest({ deliveryCost: 5 }), {
      params: { orderId: 'order_1' },
    })
    expect(response.status).toBe(409)
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('rejects a negative delivery cost', async () => {
    const response = await PATCH(buildRequest({ deliveryCost: -1 }), {
      params: { orderId: 'order_1' },
    })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/0 or more|>= 0/)
  })

  it('rejects a missing delivery cost', async () => {
    const response = await PATCH(buildRequest({}), { params: { orderId: 'order_1' } })
    expect(response.status).toBe(400)
  })

  it('rejects a delivery cost with more than two decimals', async () => {
    const response = await PATCH(buildRequest({ deliveryCost: 1.234 }), {
      params: { orderId: 'order_1' },
    })
    expect(response.status).toBe(400)
  })

  it('saves the delivery cost and reports the order', async () => {
    const response = await PATCH(buildRequest({ deliveryCost: 7.5 }), {
      params: { orderId: 'order_1' },
    })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.order.deliveryCost).toBe(7.5)
    expect(body.order.displayNumber).toBe('ORDER_1')

    const update = prismaMock.order.update.mock.calls[0][0] as any
    expect(update.data.deliveryCost).toBe(7.5)
    expect(update.where.id).toBe('order_1')
  })
})
