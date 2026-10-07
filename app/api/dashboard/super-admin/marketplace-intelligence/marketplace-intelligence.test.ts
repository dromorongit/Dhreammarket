import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/adminAuth', () => ({
  requireSuperAdmin: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

const mockGetPrisma = vi.mocked(getPrisma)
const mockRequireSuperAdmin = vi.mocked(requireSuperAdmin)

function buildMockPrisma() {
  const mockPrisma = {
    order: {
      aggregate: vi.fn(async () => ({ _sum: { total: 5000 } })),
      count: vi.fn(async () => 120),
      findMany: vi.fn(async () => []),
    },
    serviceRequest: {
      count: vi.fn(async () => 45),
    },
    store: {
      findMany: vi.fn(async () => []),
    },
    product: {
      findMany: vi.fn(async () => []),
    },
    service: {
      findMany: vi.fn(async () => []),
    },
    productCategory: {
      findMany: vi.fn(async () => []),
    },
    searchSuggestion: {
      findMany: vi.fn(async () => []),
    },
    coupon: {
      findMany: vi.fn(async () => []),
    },
  }

  return { mockPrisma }
}

describe('Marketplace intelligence API security', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)
    const ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'Authentication required' }, { status: 401 }))
    const { GET } = await import('@/app/api/dashboard/super-admin/marketplace-intelligence/route')
    const request = { url: 'http://localhost/api/dashboard/super-admin/marketplace-intelligence' } as any

    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('returns 403 for ADMIN', async () => {
    mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }))
    const { GET } = await import('@/app/api/dashboard/super-admin/marketplace-intelligence/route')
    const request = { url: 'http://localhost/api/dashboard/super-admin/marketplace-intelligence' } as any

    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it('returns 403 for CUSTOMER', async () => {
    mockRequireSuperAdmin.mockResolvedValue(NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }))
    const { GET } = await import('@/app/api/dashboard/super-admin/marketplace-intelligence/route')
    const request = { url: 'http://localhost/api/dashboard/super-admin/marketplace-intelligence' } as any

    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it('returns 200 for SUPER_ADMIN', async () => {
    mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)

    const { GET } = await import('@/app/api/dashboard/super-admin/marketplace-intelligence/route')
    const request = { url: 'http://localhost/api/dashboard/super-admin/marketplace-intelligence' } as any

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.kpis).toBeDefined()
  })
})
