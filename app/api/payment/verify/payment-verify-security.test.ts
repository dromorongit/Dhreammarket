import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/paystack', () => ({
  verifyPaystackPayment: vi.fn(() => Promise.resolve({ data: { status: 'success', amount: 10000 } })),
}))

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn(),
}))

vi.mock('@/lib/stock-reservation', () => ({
  reserveStock: vi.fn(),
  releaseStock: vi.fn(),
}))

vi.mock('@/lib/notification-preferences', () => ({
  canSendCustomerEmail: vi.fn(),
  shouldSendNotification: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  sendPaymentConfirmationEmail: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(),
}))

vi.mock('@/lib/revenue', () => ({
  calculateFinancialBreakdown: vi.fn(() => Promise.resolve({
    netAmount: 100,
    platformCommission: 10,
    vendorEarnings: 90,
    commissionRate: 0.1,
  })),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)

function buildMockPrisma() {
  const payments: any[] = []
  const orders: any[] = []
  const users: any[] = []

  const mockPrisma = {
    payment: {
      findUnique: vi.fn(async ({ where }: any) => {
        return payments.find((p) => p.reference === where.reference) || null
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = payments.findIndex((p) => p.id === where.id)
        if (idx === -1) return null
        payments[idx] = { ...payments[idx], ...data }
        return payments[idx]
      }),
    },
    order: {
      findUnique: vi.fn(async ({ where }: any) => {
        return orders.find((o) => o.id === where.id) || null
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = orders.findIndex((o) => o.id === where.id)
        if (idx === -1) return null
        orders[idx] = { ...orders[idx], ...data }
        return orders[idx]
      }),
    },
    orderItem: {
      findMany: vi.fn(async () => []),
    },
    cart: {
      findUnique: vi.fn(async () => null),
    },
    cartItem: {
      deleteMany: vi.fn(async () => ({})),
    },
    notification: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({ id: 'notif-' + Date.now(), ...data })),
    },
    store: {
      findUnique: vi.fn(async () => ({ userId: 'vendor-1' })),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        return users.find((u) => u.id === where.id) || null
      }),
    },
    profile: {
      findUnique: vi.fn(async () => null),
    },
    customerLoyalty: {
      findUnique: vi.fn(async () => ({ walletBalance: 0 })),
    },
    rewardRedemption: {
      create: vi.fn(async ({ data }: any) => ({ id: 'redemption-' + Date.now(), ...data })),
    },
  }

  return {
    mockPrisma,
    payments,
    orders,
    users,
  }
}

describe('Payment verify API security', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'customer-1', role: 'CUSTOMER', sessionId: 'session-1' } as any)
    ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  describe('POST /api/payment/verify', () => {
    const baseRequest = (body: any) => ({
      cookies: { get: () => ({ value: 'token' }) },
      headers: { get: () => null },
      json: async () => body,
    } as any)

    it('returns 401 when unauthenticated', async () => {
      mockVerifyToken.mockResolvedValue({ authenticated: false, reason: 'invalid_token' } as any)
      const { POST } = await import('@/app/api/payment/verify/route')
      const request = baseRequest({ reference: 'DHV-123' })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('returns 404 when payment belongs to another user', async () => {
      ctx.payments.push({
        id: 'payment-1',
        reference: 'DHV-123',
        userId: 'customer-2',
        orderId: 'order-1',
        amount: 100,
        currency: 'GHS',
        status: 'PENDING',
      })
      ctx.orders.push({ id: 'order-1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL' })

      mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'customer-1', role: 'CUSTOMER', sessionId: 'session-1' } as any)
      const { POST } = await import('@/app/api/payment/verify/route')
      const request = baseRequest({ reference: 'DHV-123' })

      const response = await POST(request)
      expect(response.status).toBe(404)
    })

    it('succeeds for the owner', async () => {
      ctx.payments.push({
        id: 'payment-1',
        reference: 'DHV-123',
        userId: 'customer-1',
        orderId: 'order-1',
        amount: 100,
        currency: 'GHS',
        status: 'PENDING',
      })
      ctx.orders.push({ id: 'order-1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL' })
      ctx.users.push({ id: 'customer-1', email: 'customer@test.com', profile: null })

      const { POST } = await import('@/app/api/payment/verify/route')
      const request = baseRequest({ reference: 'DHV-123' })

      const response = await POST(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('is idempotent when called twice', async () => {
      ctx.payments.push({
        id: 'payment-1',
        reference: 'DHV-123',
        userId: 'customer-1',
        orderId: 'order-1',
        amount: 100,
        currency: 'GHS',
        status: 'PAID',
      })
      ctx.orders.push({ id: 'order-1', status: 'PROCESSING', paymentStatus: 'PAID', orderType: 'NORMAL' })

      const { POST } = await import('@/app/api/payment/verify/route')
      const request = baseRequest({ reference: 'DHV-123' })

      const response1 = await POST(request)
      expect(response1.status).toBe(200)
      const data1 = await response1.json()
      expect(data1.alreadyProcessed).toBe(true)

      const response2 = await POST(request)
      expect(response2.status).toBe(200)
      const data2 = await response2.json()
      expect(data2.alreadyProcessed).toBe(true)
    })
  })
})
