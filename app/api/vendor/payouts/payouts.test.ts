import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: vi.fn(),
  requireSuperAdmin: vi.fn(),
}))

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { requireAdmin } from '@/lib/adminAuth'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)
const mockRequireAdmin = vi.mocked(requireAdmin)
const mockRequireSuperAdmin = vi.mocked(requireSuperAdmin)
const mockCreateAuditLog = vi.mocked(createAuditLog)

function buildMockPrisma() {
  const users: any[] = []
  const stores: any[] = []
  const payouts: any[] = []
  const orderItems: any[] = []

  const mockPrisma = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        return users.find((u) => u.id === where.id) || null
      }),
    },
    store: {
      findUnique: vi.fn(async ({ where }: any) => {
        return stores.find((s) => s.id === where.id || s.userId === where.userId) || null
      }),
    },
    vendorPayout: {
      findMany: vi.fn(async ({ where }: any) => {
        return payouts.filter((p) => {
          if (where.vendorId && p.vendorId !== where.vendorId) return false
          if (where.storeId && p.storeId !== where.storeId) return false
          if (where.status && p.status !== where.status) return false
          return true
        })
      }),
      count: vi.fn(async ({ where }: any) => {
        return payouts.filter((p) => {
          if (where.vendorId && p.vendorId !== where.vendorId) return false
          if (where.storeId && p.storeId !== where.storeId) return false
          if (where.status && p.status !== where.status) return false
          return true
        }).length
      }),
      create: vi.fn(async ({ data }: any) => {
        const payout = {
          id: 'payout-' + Date.now(),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        payouts.push(payout)
        return payout
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return payouts.find((p) => p.id === where.id) || null
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = payouts.findIndex((p) => p.id === where.id)
        if (idx === -1) return null
        payouts[idx] = { ...payouts[idx], ...data }
        return payouts[idx]
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = payouts.findIndex((p) => p.id === where.id)
        if (idx === -1) return null
        const deleted = payouts[idx]
        payouts.splice(idx, 1)
        return deleted
      }),
    },
    orderItem: {
      aggregate: vi.fn(async ({ where }: any) => {
        const sum = orderItems
          .filter((item: any) => {
            if (item.vendorId !== where.vendorId) return false
            if (!where.order?.status?.in?.includes(item.orderStatus)) return false
            if (where.order?.paymentStatus !== item.paymentStatus) return false
            return true
          })
          .reduce((acc: number, item: any) => acc + (item.vendorEarnings || 0), 0)
        return { _sum: { vendorEarnings: sum } }
      }),
    },
  }

  return {
    mockPrisma,
    users,
    stores,
    payouts,
    orderItems,
  }
}

describe('Vendor payout routes', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)

    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR', sessionId: 'session-1' } as any)
    mockRequireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' } as any)
    mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)
  })

  describe('GET /api/vendor/payouts', () => {
    it('returns 403 for CUSTOMER', async () => {
      mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'customer-1', role: 'CUSTOMER', sessionId: 'session-1' } as any)
      const { GET } = await import('@/app/api/vendor/payouts/route')
      const request = { cookies: { get: () => ({ value: 'token' }) }, url: 'http://localhost/api/vendor/payouts' } as any

      const response = await GET(request)
      expect(response.status).toBe(403)
    })

    it('VENDOR A cannot read VENDOR B payouts', async () => {
      ctx.stores.push({ id: 'store-1', userId: 'vendor-1' })
      ctx.stores.push({ id: 'store-2', userId: 'vendor-2' })
      ctx.payouts.push({ id: 'payout-1', vendorId: 'vendor-2', storeId: 'store-2', amount: 100, status: 'PENDING' })

      mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-1', role: 'VENDOR', sessionId: 'session-1' } as any)
      const { GET } = await import('@/app/api/vendor/payouts/route')
      const request = { cookies: { get: () => ({ value: 'token' }) }, url: 'http://localhost/api/vendor/payouts?vendorId=vendor-2' } as any

      const response = await GET(request)
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.payouts).toHaveLength(0)
    })

    it('ADMIN can pass vendorId query param', async () => {
      mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'admin-1', role: 'ADMIN', sessionId: 'session-1' } as any)
      ctx.stores.push({ id: 'store-2', userId: 'vendor-2' })
      ctx.payouts.push({ id: 'payout-1', vendorId: 'vendor-2', storeId: 'store-2', amount: 100, status: 'PENDING' })

      const { GET } = await import('@/app/api/vendor/payouts/route')
      const request = { cookies: { get: () => ({ value: 'token' }) }, url: 'http://localhost/api/vendor/payouts?vendorId=vendor-2' } as any

      const response = await GET(request)
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.payouts).toHaveLength(1)
    })
  })

  describe('POST /api/vendor/payouts', () => {
    it('returns 403 for non-SUPER_ADMIN', async () => {
      mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }))
      const { POST } = await import('@/app/api/vendor/payouts/route')
      const request = { cookies: { get: () => ({ value: 'token' }) }, json: async () => ({}) } as any

      const response = await POST(request)
      expect(response.status).toBe(403)
    })

    it('rejects invalid amounts', async () => {
      mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)
      const { POST } = await import('@/app/api/vendor/payouts/route')

      const request = { cookies: { get: () => ({ value: 'token' }) }, json: async () => ({ amount: -100 }) } as any
      let response = await POST(request)
      expect(response.status).toBe(400)

      const request2 = { cookies: { get: () => ({ value: 'token' }) }, json: async () => ({ amount: 0 }) } as any
      response = await POST(request2)
      expect(response.status).toBe(400)

      const request3 = { cookies: { get: () => ({ value: 'token' }) }, json: async () => ({ amount: NaN }) } as any
      response = await POST(request3)
      expect(response.status).toBe(400)
    })

    it('rejects amount above unpaid earnings', async () => {
      mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)
      ctx.stores.push({ id: 'store-1', userId: 'vendor-1' })
      ctx.users.push({ id: 'vendor-1', role: 'VENDOR' })
      ctx.payouts.push({ id: 'payout-1', vendorId: 'vendor-1', storeId: 'store-1', amount: 50, status: 'PAID' })
      ctx.orderItems.push({ id: 'item-1', vendorId: 'vendor-1', vendorEarnings: 100, paymentStatus: 'PAID', orderStatus: 'DELIVERED' })

      const { POST } = await import('@/app/api/vendor/payouts/route')
      const request = { cookies: { get: () => ({ value: 'token' }) }, json: async () => ({ vendorId: 'vendor-1', storeId: 'store-1', amount: 200 }) } as any

      const response = await POST(request)
      expect(response.status).toBe(400)
    })
  })

  describe('PATCH /api/vendor/payouts/[payoutId]', () => {
    it('returns 403 for non-admin', async () => {
      mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Admin access required' }, { status: 403 }))
      const { PATCH } = await import('@/app/api/vendor/payouts/[payoutId]/route')
      const request = { cookies: { get: () => ({ value: 'token' }) }, json: async () => ({}) } as any

      const response = await PATCH(request, { params: { payoutId: 'payout-1' } })
      expect(response.status).toBe(403)
    })

    it('rejects disallowed status transitions', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' } as any)
      ctx.payouts.push({ id: 'payout-1', vendorId: 'vendor-1', storeId: 'store-1', amount: 100, status: 'PAID' })

      const { PATCH } = await import('@/app/api/vendor/payouts/[payoutId]/route')
      const request = { cookies: { get: () => ({ value: 'token' }) }, json: async () => ({ status: 'PENDING' }) } as any

      const response = await PATCH(request, { params: { payoutId: 'payout-1' } })
      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /api/vendor/payouts/[payoutId]', () => {
    it('rejects delete of PAID payout', async () => {
      mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)
      ctx.payouts.push({ id: 'payout-1', vendorId: 'vendor-1', storeId: 'store-1', amount: 100, status: 'PAID' })

      const { DELETE } = await import('@/app/api/vendor/payouts/[payoutId]/route')
      const request = { cookies: { get: () => ({ value: 'token' }) } } as any

      const response = await DELETE(request, { params: { payoutId: 'payout-1' } })
      expect(response.status).toBe(400)
    })
  })
})
