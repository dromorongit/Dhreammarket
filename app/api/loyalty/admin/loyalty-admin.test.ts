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

vi.mock('@/lib/loyalty/loyalty-engine', () => ({
  LoyaltyEngine: {
    tier: {
      getLoyaltyConfig: vi.fn(),
      getLoyaltyTiers: vi.fn(),
      updateLoyaltyConfig: vi.fn(),
    },
  },
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { requireAdmin } from '@/lib/adminAuth'
import { requireSuperAdmin } from '@/lib/adminAuth'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)
const mockRequireAdmin = vi.mocked(requireAdmin)
const mockRequireSuperAdmin = vi.mocked(requireSuperAdmin)

function buildMockPrisma() {
  const achievements: any[] = []
  const campaigns: any[] = []
  const customers: any[] = []
  const tiers: any[] = []

  const mockPrisma = {
    achievement: {
      findMany: vi.fn(async () => achievements),
      create: vi.fn(async ({ data }: any) => ({ id: 'achievement-' + Date.now(), ...data })),
    },
    vendorRewardCampaign: {
      findMany: vi.fn(async () => campaigns),
      create: vi.fn(async ({ data }: any) => ({ id: 'campaign-' + Date.now(), ...data })),
    },
    customerLoyalty: {
      findMany: vi.fn(async () => customers),
      count: vi.fn(async () => customers.length),
      aggregate: vi.fn(async () => ({ _sum: { totalPointsEarned: 1000, totalCashbackEarned: 500 } })),
      groupBy: vi.fn(async () => []),
    },
    rewardTransaction: {
      count: vi.fn(async () => 10),
    },
    loyaltyTier: {
      findMany: vi.fn(async () => tiers),
      create: vi.fn(async ({ data }: any) => ({ id: 'tier-' + Date.now(), ...data })),
    },
  }

  return {
    mockPrisma,
    achievements,
    campaigns,
    customers,
    tiers,
  }
}

describe('Loyalty admin API security', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' } as any)
    mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)
    ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  describe('GET /api/loyalty/admin/analytics', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'Authentication required' }, { status: 401 }))
      const { GET } = await import('@/app/api/loyalty/admin/analytics/route')
      const request = { url: 'http://localhost/api/loyalty/admin/analytics' } as any

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 for CUSTOMER', async () => {
      mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }))
      const { GET } = await import('@/app/api/loyalty/admin/analytics/route')
      const request = { url: 'http://localhost/api/loyalty/admin/analytics' } as any

      const response = await GET(request)
      expect(response.status).toBe(403)
    })

    it('returns 403 for ADMIN on analytics GET', async () => {
      mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }))
      const { GET } = await import('@/app/api/loyalty/admin/analytics/route')
      const request = { url: 'http://localhost/api/loyalty/admin/analytics' } as any

      const response = await GET(request)
      expect(response.status).toBe(403)
    })

    it('returns 200 for SUPER_ADMIN', async () => {
      mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)

      const { GET } = await import('@/app/api/loyalty/admin/analytics/route')
      const request = { url: 'http://localhost/api/loyalty/admin/analytics' } as any

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.totalPointsEarned).toBeDefined()
    })
  })

  describe('GET /api/loyalty/admin/customers', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'Authentication required' }, { status: 401 }))
      const { GET } = await import('@/app/api/loyalty/admin/customers/route')
      const request = { url: 'http://localhost/api/loyalty/admin/customers' } as any

      const response = await GET(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 for CUSTOMER', async () => {
      mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }))
      const { GET } = await import('@/app/api/loyalty/admin/customers/route')
      const request = { url: 'http://localhost/api/loyalty/admin/customers' } as any

      const response = await GET(request)
      expect(response.status).toBe(403)
    })

    it('returns 403 for ADMIN on customers GET', async () => {
      mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }))
      const { GET } = await import('@/app/api/loyalty/admin/customers/route')
      const request = { url: 'http://localhost/api/loyalty/admin/customers' } as any

      const response = await GET(request)
      expect(response.status).toBe(403)
    })

    it('returns 200 for SUPER_ADMIN', async () => {
      mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)

      const { GET } = await import('@/app/api/loyalty/admin/customers/route')
      const request = { url: 'http://localhost/api/loyalty/admin/customers' } as any

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.customers).toBeDefined()
    })
  })

  describe('POST /api/loyalty/admin/achievements', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'Authentication required' }, { status: 401 }))
      const { POST } = await import('@/app/api/loyalty/admin/achievements/route')
      const request = {
        url: 'http://localhost/api/loyalty/admin/achievements',
        json: async () => ({ name: 'Test', slug: 'test' }),
      } as any

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 for ADMIN on achievement mutation', async () => {
      mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }))
      const { POST } = await import('@/app/api/loyalty/admin/achievements/route')
      const request = {
        url: 'http://localhost/api/loyalty/admin/achievements',
        json: async () => ({ name: 'Test', slug: 'test' }),
      } as any

      const response = await POST(request)
      expect(response.status).toBe(403)
    })

    it('returns 201 for SUPER_ADMIN', async () => {
      mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)

      const { POST } = await import('@/app/api/loyalty/admin/achievements/route')
      const request = {
        url: 'http://localhost/api/loyalty/admin/achievements',
        json: async () => ({ name: 'Test Achievement', slug: 'test-achievement' }),
      } as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.achievement.name).toBe('Test Achievement')
    })
  })

  describe('POST /api/loyalty/admin/tiers', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'Authentication required' }, { status: 401 }))
      const { POST } = await import('@/app/api/loyalty/admin/tiers/route')
      const request = {
        url: 'http://localhost/api/loyalty/admin/tiers',
        json: async () => ({ name: 'Test', slug: 'test' }),
      } as any

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('returns 403 for ADMIN on tier mutation', async () => {
      mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }))
      const { POST } = await import('@/app/api/loyalty/admin/tiers/route')
      const request = {
        url: 'http://localhost/api/loyalty/admin/tiers',
        json: async () => ({ name: 'Test', slug: 'test' }),
      } as any

      const response = await POST(request)
      expect(response.status).toBe(403)
    })

    it('returns 201 for SUPER_ADMIN', async () => {
      mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)

      const { POST } = await import('@/app/api/loyalty/admin/tiers/route')
      const request = {
        url: 'http://localhost/api/loyalty/admin/tiers',
        json: async () => ({ name: 'Gold', slug: 'gold' }),
      } as any

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.tier.name).toBe('Gold')
    })
  })
})
