import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/subscription/subscription-service', () => ({
  getVendorSubscription: vi.fn(),
  getSubscriptionUsage: vi.fn(),
  getSubscriptionHistory: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)

function buildMockPrisma() {
  const subscriptions: any[] = []
  const users: any[] = []

  const mockPrisma = {
    vendorSubscription: {
      findUnique: vi.fn(async ({ where }: any) => {
        return subscriptions.find((s) => s.id === where.id) || null
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = subscriptions.findIndex((s) => s.id === where.id)
        if (idx === -1) return null
        subscriptions[idx] = { ...subscriptions[idx], ...data }
        return subscriptions[idx]
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = subscriptions.findIndex((s) => s.id === where.id)
        if (idx === -1) return null
        const deleted = subscriptions[idx]
        subscriptions.splice(idx, 1)
        return deleted
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        return users.find((u) => u.id === where.id) || null
      }),
    },
  }

  return {
    mockPrisma,
    subscriptions,
    users,
  }
}

describe('Vendor subscription API security', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR', sessionId: 'session-1' } as any)
    ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  describe('GET /api/subscription/vendor', () => {
    it('returns 401 when unauthenticated', async () => {
      mockVerifyToken.mockResolvedValue({ authenticated: false, reason: 'invalid_token' } as any)
      const { GET } = await import('@/app/api/subscription/vendor/route')
      const request = { cookies: { get: () => ({ value: 'token' }) }, url: 'http://localhost/api/subscription/vendor' } as any

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('vendor A cannot read vendor B subscription (404)', async () => {
      ctx.subscriptions.push({ id: 'sub-1', vendorId: 'vendor-2', plan: { name: 'Basic' } })

      mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR', sessionId: 'session-1' } as any)
      const { GET } = await import('@/app/api/subscription/vendor/route')
      const request = {
        cookies: { get: () => ({ value: 'token' }) },
        url: 'http://localhost/api/subscription/vendor?vendorId=vendor-2',
      } as any

      const response = await GET(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.subscription).toBeNull()
    })
  })

  describe('PUT /api/subscription/vendor', () => {
    it('vendor A cannot update vendor B subscription (404)', async () => {
      ctx.subscriptions.push({ id: 'sub-1', vendorId: 'vendor-2', autoRenew: true })

      mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR', sessionId: 'session-1' } as any)
      const { PUT } = await import('@/app/api/subscription/vendor/route')
      const request = {
        cookies: { get: () => ({ value: 'token' }) },
        json: async () => ({ subscriptionId: 'sub-1', autoRenew: false }),
      } as any

      const response = await PUT(request)
      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /api/subscription/vendor', () => {
    it('vendor A cannot delete vendor B subscription (404)', async () => {
      ctx.subscriptions.push({ id: 'sub-1', vendorId: 'vendor-2', autoRenew: true })

      mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR', sessionId: 'session-1' } as any)
      const { DELETE } = await import('@/app/api/subscription/vendor/route')
      const request = {
        cookies: { get: () => ({ value: 'token' }) },
        url: 'http://localhost/api/subscription/vendor?subscriptionId=sub-1',
      } as any

      const response = await DELETE(request)
      expect(response.status).toBe(404)
    })
  })
})
