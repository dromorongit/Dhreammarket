import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  order: { findFirst: vi.fn() },
  payment: { findUnique: vi.fn(), upsert: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const initializePaystackPaymentMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/paystack', () => ({ initializePaystackPayment: initializePaystackPaymentMock }))

const rateLimitByKeyMock = vi.hoisted(() => vi.fn(() => ({ success: true })))
vi.mock('@/lib/rate-limit', () => ({
  rateLimitByKey: rateLimitByKeyMock,
  getClientIP: vi.fn(() => '1.2.3.4'),
  RATE_LIMIT_CONFIGS: { 'receipt-pay': { windowMs: 60000, maxRequests: 10 } },
}))

import { POST } from '@/app/api/receipt/[token]/pay/route'

const TOKEN = 'ab12cd34ef56ab78cd90ef12ab34cd56'

function req(token = TOKEN) {
  return new NextRequest(`http://localhost/api/receipt/${token}/pay`, {
    method: 'POST',
    headers: { 'x-forwarded-for': '1.2.3.4' },
  })
}

function mockOrder(overrides: any = {}) {
  prismaMock.order.findFirst.mockResolvedValue({
    id: 'order_1',
    source: 'MANUAL',
    status: 'PROCESSING',
    paymentStatus: 'PENDING',
    total: 25,
    receiptToken: TOKEN,
    customerEmail: 'ada@example.com',
    items: [{ product: { storeId: 'store_1' } }],
    ...overrides,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PAYLINK_ENABLED = 'true'
  rateLimitByKeyMock.mockReturnValue({ success: true })
  mockOrder()
  prismaMock.payment.findUnique.mockResolvedValue(null)
  prismaMock.payment.upsert.mockResolvedValue({
    authorizationUrl: 'https://paystack.co/pay/new',
    reference: 'MAN-NEW',
  })
  initializePaystackPaymentMock.mockResolvedValue({
    status: true,
    message: 'success',
    data: { authorization_url: 'https://paystack.co/pay/abc', reference: 'MAN-REF', access_code: 'ac_1' },
  })
})

describe('POST /api/receipt/[token]/pay', () => {
  it('returns 404 for a bad token', async () => {
    const res = await POST(req('bad'), { params: { token: 'bad' } })
    expect(res.status).toBe(404)
  })

  it('returns 409 when already paid', async () => {
    mockOrder({ paymentStatus: 'PAID' })
    const res = await POST(req(), { params: { token: TOKEN } })
    expect(res.status).toBe(409)
  })

  it('returns 409 when cancelled', async () => {
    mockOrder({ status: 'CANCELLED' })
    const res = await POST(req(), { params: { token: TOKEN } })
    expect(res.status).toBe(409)
  })

  it('returns 503 when disabled', async () => {
    process.env.PAYLINK_ENABLED = 'false'
    const res = await POST(req(), { params: { token: TOKEN } })
    expect(res.status).toBe(503)
  })

  it('returns an authorizationUrl on success', async () => {
    const res = await POST(req(), { params: { token: TOKEN } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.authorizationUrl).toBe('https://paystack.co/pay/new')
  })

  it('enforces rate limits', async () => {
    const { NextResponse } = await import('next/server')
    rateLimitByKeyMock.mockReturnValueOnce({
      success: false,
      response: NextResponse.json({ error: 'Too many requests' }, { status: 429 }),
    })
    const res = await POST(req(), { params: { token: TOKEN } })
    expect(res.status).toBe(429)
  })
})
