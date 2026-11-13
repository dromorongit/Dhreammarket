import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  isCancellationPolicyEnabled: vi.fn(),
  isWalletRestoreOnCancelEnabled: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: mocks.verifyToken }))
vi.mock('@/lib/feature-flags', () => ({
  isCancellationPolicyEnabled: mocks.isCancellationPolicyEnabled,
  isWalletRestoreOnCancelEnabled: mocks.isWalletRestoreOnCancelEnabled,
}))

import { getPrisma } from '@/lib/prisma'
import { GET } from '@/app/api/orders/[orderId]/cancel-preview/route'

const mockGetPrisma = vi.mocked(getPrisma)

const NOW = new Date('2026-01-01T12:00:00Z')

function baseOrder(): any {
  return {
    id: 'order_1',
    userId: 'user_1',
    total: 100,
    paymentStatus: 'PAID',
    source: 'ONLINE',
    orderType: 'NORMAL',
    createdAt: new Date('2026-01-01T10:00:00Z'),
  }
}

function buildMockPrisma(order: any, cutover: Date | null = null) {
  const mockPrisma = {
    order: { findFirst: vi.fn(async () => order) },
    platformPolicy: { findUnique: vi.fn(async () => ({ systemCutoverTimestamp: cutover })) },
    user: { findUnique: vi.fn(async () => ({ id: 'user_1', cancellationBlockedUntil: null })) },
    customerCancellation: { count: vi.fn(async () => 0) },
  }
  return mockPrisma
}

function requestWithToken(token = 'token_user_1') {
  return new NextRequest('http://localhost/api/orders/order_1/cancel-preview', {
    method: 'GET',
    headers: { cookie: `token=${token}` },
  }) as any
}

describe('GET /api/orders/[orderId]/cancel-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mocks.verifyToken.mockResolvedValue({
      authenticated: true,
      userId: 'user_1',
      role: 'CUSTOMER',
      sessionId: 'sess_1',
    })
    mocks.isWalletRestoreOnCancelEnabled.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.verifyToken.mockResolvedValue({ authenticated: false, reason: 'session_expired' })
    const ctx = buildMockPrisma(baseOrder())
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    expect(response.status).toBe(401)
  })

  it('returns 404 for another user\'s order (no existence leak)', async () => {
    const ctx = buildMockPrisma(null)
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    expect(response.status).toBe(404)
  })

  it('policy off: today\'s behaviour, free with full refund', async () => {
    mocks.isCancellationPolicyEnabled.mockReturnValue(false)
    const ctx = buildMockPrisma(baseOrder(), null)
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.policyActive).toBe(false)
    expect(json.free).toBe(true)
    expect(json.feeAmount).toBe(0)
    expect(json.refundAmount).toBe(100)
    expect(json.cancellationsInLast30Days).toBe(0)
    expect(json.blockedUntil).toBeNull()
    expect(json.wouldTriggerBlock).toBe(false)
  })

  it('pre-cutover order: policy inactive even with flag on', async () => {
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    const ctx = buildMockPrisma({ ...baseOrder(), createdAt: new Date('2025-12-01T10:00:00Z') }, new Date('2026-01-01T00:00:00Z'))
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    const json = await response.json()
    expect(json.policyActive).toBe(false)
  })

  it('policy active, paid, within 60 minutes: free', async () => {
    vi.setSystemTime(NOW)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    const ctx = buildMockPrisma(
      { ...baseOrder(), createdAt: new Date('2026-01-01T11:01:00Z') },
      new Date('2026-01-01T00:00:00Z')
    )
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    const json = await response.json()
    expect(json.policyActive).toBe(true)
    expect(json.free).toBe(true)
    expect(json.feeAmount).toBe(0)
    expect(json.refundAmount).toBe(100)
    expect(json.cancellationsInLast30Days).toBe(0)
    expect(json.blockedUntil).toBeNull()
    expect(json.wouldTriggerBlock).toBe(false)
  })

  it('policy active, paid, at 61 minutes: GHS 5 fee', async () => {
    vi.setSystemTime(NOW)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    const ctx = buildMockPrisma(
      { ...baseOrder(), createdAt: new Date('2026-01-01T10:59:00Z') },
      new Date('2026-01-01T00:00:00Z')
    )
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    const json = await response.json()
    expect(json.free).toBe(false)
    expect(json.feeAmount).toBe(5)
    expect(json.refundAmount).toBe(95)
  })

  it('policy active, blocked: reports blockedUntil and wouldTriggerBlock false', async () => {
    vi.setSystemTime(NOW)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    const ctx = buildMockPrisma(baseOrder(), new Date('2026-01-01T00:00:00Z'))
    ;(ctx.user.findUnique as any).mockResolvedValueOnce({ id: 'user_1', cancellationBlockedUntil: new Date('2026-06-01T00:00:00Z') })
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    const json = await response.json()
    expect(json.policyActive).toBe(true)
    expect(json.blockedUntil).toBe('2026-06-01T00:00:00.000Z')
    expect(json.wouldTriggerBlock).toBe(false)
  })

  it('policy active, 3 prior cancellations: wouldTriggerBlock true', async () => {
    vi.setSystemTime(NOW)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    const ctx = buildMockPrisma(baseOrder(), new Date('2026-01-01T00:00:00Z'))
    ;(ctx.customerCancellation.count as any).mockResolvedValueOnce(3)
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    const json = await response.json()
    expect(json.cancellationsInLast30Days).toBe(3)
    expect(json.wouldTriggerBlock).toBe(true)
  })

  it('59 minutes from payment confirmation: free', async () => {
    vi.setSystemTime(NOW)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    const ctx = buildMockPrisma(
      {
        ...baseOrder(),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        paymentConfirmedAt: new Date('2026-01-01T11:01:00Z'),
        payment: { status: 'PAID', createdAt: new Date('2026-01-01T11:01:00Z') },
      },
      new Date('2026-01-01T00:00:00Z')
    )
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    const json = await response.json()
    expect(json.policyActive).toBe(true)
    expect(json.free).toBe(true)
    expect(json.feeAmount).toBe(0)
    expect(json.refundAmount).toBe(100)
  })

  it('61 minutes from payment confirmation: GHS 5 fee', async () => {
    vi.setSystemTime(NOW)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    const ctx = buildMockPrisma(
      {
        ...baseOrder(),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        paymentConfirmedAt: new Date('2026-01-01T10:59:00Z'),
        payment: { status: 'PAID', createdAt: new Date('2026-01-01T10:59:00Z') },
      },
      new Date('2026-01-01T00:00:00Z')
    )
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    const json = await response.json()
    expect(json.policyActive).toBe(true)
    expect(json.free).toBe(false)
    expect(json.feeAmount).toBe(5)
    expect(json.refundAmount).toBe(95)
  })

  it('order created 3 hours before it was paid: still free', async () => {
    vi.setSystemTime(NOW)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    const ctx = buildMockPrisma(
      {
        ...baseOrder(),
        createdAt: new Date('2026-01-01T09:00:00Z'),
        paymentConfirmedAt: new Date('2026-01-01T11:01:00Z'),
        payment: { status: 'PAID', createdAt: new Date('2026-01-01T11:01:00Z') },
      },
      new Date('2026-01-01T00:00:00Z')
    )
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    const json = await response.json()
    expect(json.policyActive).toBe(true)
    expect(json.free).toBe(true)
    expect(json.refundAmount).toBe(100)
  })

  it('fallback: paid order with no payment confirmation timestamp uses order.createdAt', async () => {
    vi.setSystemTime(NOW)
    mocks.isCancellationPolicyEnabled.mockReturnValue(true)
    const ctx = buildMockPrisma(
      {
        ...baseOrder(),
        createdAt: new Date('2026-01-01T11:01:00Z'),
        paymentConfirmedAt: null,
        payment: null,
      },
      new Date('2026-01-01T00:00:00Z')
    )
    mockGetPrisma.mockReturnValue(ctx as any)
    const response = await GET(requestWithToken(), { params: { orderId: 'order_1' } } as any)
    const json = await response.json()
    expect(json.policyActive).toBe(true)
    expect(json.free).toBe(true)
    expect(json.refundAmount).toBe(100)
  })
})
