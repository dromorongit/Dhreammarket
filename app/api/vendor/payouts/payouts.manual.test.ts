import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: vi.fn() }))
vi.mock('@/lib/adminAuth', () => ({ requireSuperAdmin: vi.fn() }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)
const mockRequireSuperAdmin = vi.mocked(requireSuperAdmin)
const mockCreateAuditLog = vi.mocked(createAuditLog)

beforeEach(() => {
  vi.clearAllMocks()
  mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)
  mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)
  mockCreateAuditLog.mockResolvedValue(undefined)
})

function buildMockPrisma(eligibleEarnings: number) {
  const stores: any[] = [{ id: 'store-1', userId: 'vendor-1' }]
  const users: any[] = [{ id: 'vendor-1', role: 'VENDOR' }]

  const mockPrisma: any = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.find((u) => u.id === where.id && u.role === where.role) || null),
    },
    store: {
      findUnique: vi.fn(async ({ where }: any) => stores.find((s) => s.id === where.id || s.userId === where.userId) || null),
    },
    orderItem: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { vendorEarnings: eligibleEarnings } }),
    },
    vendorPayout: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'payout-1' }),
    },
  }
  return mockPrisma
}

describe('payout eligibility excludes MANUAL orders', () => {
  it('adds source ONLINE to orderItem aggregate for eligible earnings', async () => {
    const mockPrisma = buildMockPrisma(500)
    mockGetPrisma.mockReturnValue(mockPrisma)

    const { POST } = await import('@/app/api/vendor/payouts/route')
    const request = {
      cookies: { get: () => ({ value: 'token' }) },
      json: async () => ({ vendorId: 'vendor-1', storeId: 'store-1', amount: 50, reference: 'ref-1', note: 'test' }),
    } as any

    const response = await POST(request)
    expect(response.status).toBe(201)

    const aggregateCall = mockPrisma.orderItem.aggregate.mock.calls[0]
    const where = aggregateCall[0].where
    expect(where.order.source).toBe('ONLINE')
    expect(where.order.paymentStatus).toBe('PAID')
    expect(where.order.status).toEqual({ in: ['DELIVERED', 'COMPLETED'] })
  })
})
