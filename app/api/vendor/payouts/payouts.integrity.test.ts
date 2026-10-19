import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: vi.fn() }))
vi.mock('@/lib/adminAuth', () => ({ requireSuperAdmin: vi.fn() }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { POST } from '@/app/api/vendor/payouts/route'

const mockGetPrisma = vi.mocked(getPrisma)
const mockRequireSuperAdmin = vi.mocked(requireSuperAdmin)

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireSuperAdmin.mockResolvedValue({ userId: 'superadmin-1', role: 'SUPER_ADMIN' } as any)
})

function buildPrisma(store: any) {
  return {
    store: { findUnique: vi.fn().mockResolvedValue(store) },
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'vendor-1', role: 'VENDOR' }) },
    orderItem: { aggregate: vi.fn().mockResolvedValue({ _sum: { vendorEarnings: 100 } }) },
    vendorPayout: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'payout-1' }) },
  } as any
}

describe('payout creation store/vendor integrity', () => {
  it('rejects a mismatched vendor and store without creating a payout', async () => {
    mockGetPrisma.mockReturnValue(buildPrisma({ id: 'store-1', userId: 'vendor-2' }))
    const request = {
      cookies: { get: () => ({ value: 'token' }) },
      json: async () => ({ vendorId: 'vendor-1', storeId: 'store-1', amount: 10, reference: 'ref', note: 'n' }),
    } as any
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Store does not belong to the specified vendor')
    expect(buildPrisma({ id: 'store-1', userId: 'vendor-2' }).vendorPayout.create).not.toHaveBeenCalled()
  })

  it('creates a payout for a matching vendor/store pair', async () => {
    const prisma = buildPrisma({ id: 'store-1', userId: 'vendor-1' })
    mockGetPrisma.mockReturnValue(prisma)
    const request = {
      cookies: { get: () => ({ value: 'token' }) },
      json: async () => ({ vendorId: 'vendor-1', storeId: 'store-1', amount: 10, reference: 'ref', note: 'n' }),
    } as any
    const response = await POST(request)
    expect(response.status).toBe(201)
    expect(prisma.vendorPayout.create).toHaveBeenCalled()
  })

  it('derives the store from the vendor when storeId is omitted', async () => {
    const prisma = buildPrisma({ id: 'store-1', userId: 'vendor-1' })
    mockGetPrisma.mockReturnValue(prisma)
    const request = {
      cookies: { get: () => ({ value: 'token' }) },
      json: async () => ({ vendorId: 'vendor-1', amount: 10, reference: 'ref', note: 'n' }),
    } as any
    const response = await POST(request)
    expect(response.status).toBe(201)
  })
})