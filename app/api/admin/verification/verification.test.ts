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
}))

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  sendVerificationStatusEmail: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { requireAdmin } from '@/lib/adminAuth'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)
const mockRequireAdmin = vi.mocked(requireAdmin)

function buildMockPrisma() {
  const applications: any[] = []
  const stores: any[] = []
  const users: any[] = []

  const mockPrisma = {
    vendorVerificationApplication: {
      findMany: vi.fn(async ({ where }: any) => {
        return applications.filter((a) => {
          if (where.paymentStatus && a.paymentStatus !== where.paymentStatus) return false
          if (where.status && a.status !== where.status) return false
          if (where.OR) {
            const matchesSearch = where.OR.some((cond: any) => {
              if (cond.store?.name?.contains) {
                return a.store?.name?.toLowerCase().includes(cond.store.name.contains.toLowerCase())
              }
              if (cond.vendor?.email?.contains) {
                return a.vendor?.email?.toLowerCase().includes(cond.vendor.email.contains.toLowerCase())
              }
              return false
            })
            if (!matchesSearch) return false
          }
          return true
        })
      }),
      count: vi.fn(async ({ where }: any) => {
        return applications.filter((a) => {
          if (where.paymentStatus && a.paymentStatus !== where.paymentStatus) return false
          if (where.status && a.status !== where.status) return false
          return true
        }).length
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return applications.find((a) => a.id === where.id) || null
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = applications.findIndex((a) => a.id === where.id)
        if (idx === -1) return null
        applications[idx] = { ...applications[idx], ...data }
        return applications[idx]
      }),
    },
    store: {
      findUnique: vi.fn(async ({ where }: any) => {
        return stores.find((s) => s.id === where.id) || null
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = stores.findIndex((s) => s.id === where.id)
        if (idx === -1) return null
        stores[idx] = { ...stores[idx], ...data }
        return stores[idx]
      }),
    },
    verificationAuditLog: {
      create: vi.fn(async ({ data }: any) => {
        return { id: 'audit-' + Date.now(), ...data }
      }),
    },
  }

  return {
    mockPrisma,
    applications,
    stores,
    users,
  }
}

describe('Admin verification API security', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' } as any)
    ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  describe('GET /api/admin/verification', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Authentication required' }, { status: 401 }))
      const { GET } = await import('@/app/api/admin/verification/route')
      const request = { url: 'http://localhost/api/admin/verification' } as any

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 for CUSTOMER', async () => {
      mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Admin access required' }, { status: 403 }))
      const { GET } = await import('@/app/api/admin/verification/route')
      const request = { url: 'http://localhost/api/admin/verification' } as any

      const response = await GET(request)
      expect(response.status).toBe(403)
    })

    it('returns 403 for VENDOR', async () => {
      mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Admin access required' }, { status: 403 }))
      const { GET } = await import('@/app/api/admin/verification/route')
      const request = { url: 'http://localhost/api/admin/verification' } as any

      const response = await GET(request)
      expect(response.status).toBe(403)
    })

    it('returns 200 for ADMIN', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' } as any)
      ctx.applications.push({
        id: 'app-1',
        paymentStatus: 'PAID',
        status: 'PENDING',
        store: { id: 'store-1', name: 'Store 1', badgeTier: null },
        vendor: { id: 'vendor-1', email: 'vendor@test.com', profile: { firstName: 'John', lastName: 'Doe', phone: '123' } },
        documents: [],
        payments: [],
        auditLogs: [],
      })

      const { GET } = await import('@/app/api/admin/verification/route')
      const request = { url: 'http://localhost/api/admin/verification' } as any

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.applications).toHaveLength(1)
    })
  })

  describe('PATCH /api/admin/verification', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Authentication required' }, { status: 401 }))
      const { PATCH } = await import('@/app/api/admin/verification/route')
      const request = {
        url: 'http://localhost/api/admin/verification?applicationId=app-1',
        json: async () => ({ action: 'approve' }),
      } as any

      const response = await PATCH(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 for CUSTOMER', async () => {
      mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Admin access required' }, { status: 403 }))
      const { PATCH } = await import('@/app/api/admin/verification/route')
      const request = {
        url: 'http://localhost/api/admin/verification?applicationId=app-1',
        json: async () => ({ action: 'approve' }),
      } as any

      const response = await PATCH(request)
      expect(response.status).toBe(403)
    })

    it('returns 403 for VENDOR', async () => {
      mockRequireAdmin.mockResolvedValue(NextResponse.json({ error: 'Admin access required' }, { status: 403 }))
      const { PATCH } = await import('@/app/api/admin/verification/route')
      const request = {
        url: 'http://localhost/api/admin/verification?applicationId=app-1',
        json: async () => ({ action: 'approve' }),
      } as any

      const response = await PATCH(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 for invalid action', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' } as any)
      ctx.applications.push({
        id: 'app-1',
        paymentStatus: 'PAID',
        status: 'PENDING',
        storeId: 'store-1',
        vendorId: 'vendor-1',
        store: { id: 'store-1', name: 'Store 1' },
        vendor: { id: 'vendor-1', email: 'vendor@test.com', profile: { firstName: 'John', lastName: 'Doe' } },
        documents: [],
        payments: [],
        auditLogs: [],
      })

      const { PATCH } = await import('@/app/api/admin/verification/route')
      const request = {
        url: 'http://localhost/api/admin/verification?applicationId=app-1',
        json: async () => ({ action: 'invalid_action' }),
      } as any

      const response = await PATCH(request)
      expect(response.status).toBe(400)
    })
  })
})
