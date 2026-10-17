import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  order: { findFirst: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

const createAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: createAuditLogMock }))

import { PATCH } from '@/app/api/vendor/manual-orders/[orderId]/confirm-payment/route'

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_v',
}

const PARAMS = { params: { orderId: 'order_1' } }

function buildRequest(body: unknown, withToken = true): NextRequest {
  return new NextRequest('http://localhost/api/vendor/manual-orders/order_1/confirm-payment', {
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

function mockTx() {
  const tx = {
    order: { update: vi.fn().mockResolvedValue({ id: 'order_1' }) },
  }
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx))
  return tx
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth()
  mockOnboarded()
  mockStore()
  mockTx()
  prismaMock.order.findFirst.mockResolvedValue({
    id: 'order_1',
    source: 'MANUAL',
    status: 'PROCESSING',
    paymentStatus: 'PENDING',
    paymentMethod: null,
    paymentConfirmedAt: null,
    receiptToken: 'tok_1',
    total: 25,
  })
})

describe('PATCH /api/vendor/manual-orders/[orderId]/confirm-payment', () => {
  it('returns 401 when no token cookie is present', async () => {
    const response = await PATCH(buildRequest({ paymentMethod: 'MOBILE_MONEY' }, false), PARAMS)
    expect(response.status).toBe(401)
  })

  it('returns 403 when the token is not authenticated', async () => {
    mockAuth(false)
    const response = await PATCH(buildRequest({ paymentMethod: 'MOBILE_MONEY' }), PARAMS)
    expect(response.status).toBe(403)
  })

  it('returns 403 when the vendor is not onboarded', async () => {
    mockOnboarded(false)
    const response = await PATCH(buildRequest({ paymentMethod: 'MOBILE_MONEY' }), PARAMS)
    expect(response.status).toBe(403)
  })

  it('returns 404 when the vendor has no store', async () => {
    mockStore(null)
    const response = await PATCH(buildRequest({ paymentMethod: 'MOBILE_MONEY' }), PARAMS)
    expect(response.status).toBe(404)
  })

  it('returns 404 when the order is not the vendorâ€™s manual order', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null)
    const response = await PATCH(buildRequest({ paymentMethod: 'MOBILE_MONEY' }), PARAMS)
    expect(response.status).toBe(404)
  })

  it('rejects confirming an ONLINE order with 409', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'order_1',
      source: 'ONLINE',
      paymentStatus: 'PENDING',
    })
    const response = await PATCH(buildRequest({ paymentMethod: 'MOBILE_MONEY' }), PARAMS)
    expect(response.status).toBe(409)
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('rejects confirming a cancelled order with 409', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'order_1',
      source: 'MANUAL',
      paymentStatus: 'CANCELLED',
    })
    const response = await PATCH(buildRequest({ paymentMethod: 'MOBILE_MONEY' }), PARAMS)
    expect(response.status).toBe(409)
  })

  it('requires paymentMethod', async () => {
    const response = await PATCH(buildRequest({}), PARAMS)
    expect(response.status).toBe(400)
  })

  it('is idempotent when already PAID: no update, returns current state', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'order_1',
      source: 'MANUAL',
      paymentStatus: 'PAID',
      paymentMethod: 'MOBILE_MONEY',
      paymentConfirmedAt: new Date('2026-01-02T00:00:00.000Z'),
      receiptToken: 'tok_1',
      total: 25,
    })
    const response = await PATCH(buildRequest({ paymentMethod: 'CASH' }), PARAMS)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.order.paymentStatus).toBe('PAID')
    expect(body.order.paymentMethod).toBe('MOBILE_MONEY')
    expect(prismaMock.order.update).not.toHaveBeenCalled()
    expect(createAuditLogMock).not.toHaveBeenCalled()
  })

  it('confirms a pending manual order and audits it', async () => {
    const tx = mockTx()
    const response = await PATCH(buildRequest({ paymentMethod: 'MOBILE_MONEY' }), PARAMS)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.order.paymentStatus).toBe('PAID')
    expect(body.order.paymentMethod).toBe('MOBILE_MONEY')
    expect(typeof body.order.paymentConfirmedAt).toBe('string')

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: {
        paymentStatus: 'PAID',
        paymentMethod: 'MOBILE_MONEY',
        paymentConfirmedAt: expect.any(Date),
      },
    })

    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYMENT_CONFIRMED',
        entityType: 'ORDER',
        entityId: 'order_1',
        afterData: expect.objectContaining({ source: 'MANUAL', paymentStatus: 'PAID', paymentMethod: 'MOBILE_MONEY' }),
      })
    )
  })

  it('rejects a failed payment status', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 'order_1',
      source: 'MANUAL',
      paymentStatus: 'FAILED',
    })
    const response = await PATCH(buildRequest({ paymentMethod: 'MOBILE_MONEY' }), PARAMS)
    expect(response.status).toBe(400)
  })
})

