import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  order: { findFirst: vi.fn() },
  payment: { findUnique: vi.fn(), upsert: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

const initializePaystackPaymentMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/paystack', () => ({ initializePaystackPayment: initializePaystackPaymentMock }))

import { POST } from '@/app/api/vendor/manual-orders/[orderId]/pay-link/route'

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_v',
}

const PARAMS = { params: { orderId: 'order_1' } }

function buildRequest(withToken = true): NextRequest {
  return new NextRequest('http://localhost/api/vendor/manual-orders/order_1/pay-link', {
    method: 'POST',
    headers: {
      ...(withToken ? { cookie: 'token=test-token' } : {}),
    },
  })
}

function mockAuth(authenticated = true) {
  verifyTokenMock.mockResolvedValue(
    authenticated ? VENDOR : { authenticated: false, reason: 'invalid_token' }
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

function mockPayment(payment: any) {
  prismaMock.payment.findUnique.mockResolvedValue(payment)
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
    paymentStatus: 'PENDING',
    total: 25,
    customerEmail: 'ada@example.com',
    receiptToken: 'tok_1',
    items: { some: {} },
  })
  mockPayment(null)
  prismaMock.payment.upsert.mockResolvedValue({
    authorizationUrl: 'https://paystack.co/pay/new',
    reference: 'MAN-NEW',
  })
  process.env.PAYLINK_ENABLED = 'true'
  delete process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN
  initializePaystackPaymentMock.mockResolvedValue({
    status: true,
    message: 'success',
    data: {
      authorization_url: 'https://paystack.co/pay/abc',
      reference: 'MAN-REF',
      access_code: 'ac_1',
    },
  })
})

describe('POST /api/vendor/manual-orders/[orderId]/pay-link', () => {
  it('returns 503 when pay links are disabled', async () => {
    process.env.PAYLINK_ENABLED = 'false'
    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.error).toBe('Pay links are disabled')
  })

  it('returns 401 when no token cookie is present', async () => {
    const response = await POST(buildRequest(false), PARAMS)
    expect(response.status).toBe(401)
  })

  it('returns 404 when the order is not the vendor\u2019s manual order (not-owner)', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null)
    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(404)
  })

  it('rejects a non-manual order with 409', async () => {
    mockOrder({
      id: 'order_1',
      source: 'ONLINE',
      status: 'PROCESSING',
      paymentStatus: 'PENDING',
      total: 25,
      customerEmail: 'ada@example.com',
      receiptToken: 'tok_1',
    })
    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(409)
  })

  it('returns the receipt URL when the order is already paid', async () => {
    mockOrder({
      id: 'order_1',
      source: 'MANUAL',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      total: 25,
      customerEmail: 'ada@example.com',
      receiptToken: 'tok_1',
    })
    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.receiptUrl).toBeDefined()
    expect(initializePaystackPaymentMock).not.toHaveBeenCalled()
  })

  it('reuses an existing fresh PENDING pay link instead of creating a new one', async () => {
    mockPayment({
      id: 'pay_1',
      reference: 'MAN-EXISTING',
      amount: 25,
      status: 'PENDING',
      authorizationUrl: 'https://paystack.co/pay/existing',
      updatedAt: new Date(),
      createdAt: new Date(),
    })
    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.authorizationUrl).toBe('https://paystack.co/pay/existing')
    expect(json.reference).toBe('MAN-EXISTING')
    expect(initializePaystackPaymentMock).not.toHaveBeenCalled()
  })

  it('creates a fresh link when an existing PENDING link is stale', async () => {
    mockPayment({
      id: 'pay_1',
      reference: 'MAN-STALE',
      amount: 25,
      status: 'PENDING',
      authorizationUrl: 'https://paystack.co/pay/stale',
      updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    })
    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.authorizationUrl).toBe('https://paystack.co/pay/new')
    expect(initializePaystackPaymentMock).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when there is no customer email and no fallback domain', async () => {
    mockOrder({
      id: 'order_1',
      source: 'MANUAL',
      status: 'PROCESSING',
      paymentStatus: 'PENDING',
      total: 25,
      customerEmail: null,
      receiptToken: 'tok_1',
    })
    delete process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN
    const response = await POST(buildRequest(), PARAMS)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toContain('Customer email is required')
  })
})

