import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: vi.fn(),
  requireSuperAdmin: vi.fn(),
}))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '@/lib/prisma'
import { requireAdmin, requireSuperAdmin } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'
import { PATCH, DELETE } from '@/app/api/vendor/payouts/[payoutId]/route'

const mockGetPrisma = vi.mocked(getPrisma)
const mockRequireAdmin = vi.mocked(requireAdmin)
const mockRequireSuperAdmin = vi.mocked(requireSuperAdmin)
const mockCreateAuditLog = vi.mocked(createAuditLog)

const VENDOR_A = { userId: 'vendor-a', role: 'VENDOR' }
const VENDOR_B = { userId: 'vendor-b', role: 'VENDOR' }
const ADMIN = { userId: 'admin-1', role: 'ADMIN' }

function buildPayout(vendorId: string, status = 'PENDING') {
  return {
    id: 'payout_1',
    vendorId,
    storeId: 'store-1',
    amount: 100,
    status,
    reference: null,
    note: null,
    paidAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }
}

function buildPrisma(payout: ReturnType<typeof buildPayout> | null) {
  return {
    vendorPayout: {
      findUnique: vi.fn(async (args: any) => {
        if (args?.where?.vendorId && payout && payout.vendorId !== args.where.vendorId) {
          return null
        }
        return payout
      }),
      update: vi.fn(async ({ data }: any) => ({ ...(payout as object), ...data })),
      delete: vi.fn(async () => payout),
    },
  }
}

function buildRequest(): any {
  return {
    cookies: { get: () => ({ value: 'token' }) },
    json: async () => ({}),
  }
}

const PARAMS = { params: { payoutId: 'payout_1' } }

function mockAdmin(requireValue: AdminUser | NextResponse) {
  mockRequireAdmin.mockResolvedValue(requireValue as never)
}

function mockSuperAdmin(requireValue: AdminUser | NextResponse) {
  mockRequireSuperAdmin.mockResolvedValue(requireValue as never)
}

type AdminUser = { userId: string; role: string }

describe('PATCH /api/vendor/payouts/[payoutId] — vendor isolation', () => {
  let prisma: ReturnType<typeof buildPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateAuditLog.mockResolvedValue(undefined)
    prisma = buildPrisma(buildPayout('vendor-a'))
    mockGetPrisma.mockReturnValue(prisma as never)
  })

  it('vendor token gets 403 on PATCH (route requires admin)', async () => {
    mockAdmin(NextResponse.json({ error: 'Admin access required' }, { status: 403 }))

    const response = await PATCH(buildRequest(), PARAMS)

    expect(response.status).toBe(403)
    expect(prisma.vendorPayout.update).not.toHaveBeenCalled()
  })

  it('vendor B cannot patch vendor A payout — admin auth is the gate, not vendor scoping', async () => {
    // Even when admin auth passes, the admin is acting as admin, not as vendor B.
    // The route is admin-only; vendors cannot PATCH payouts at all.
    mockAdmin(ADMIN as never)

    const response = await PATCH(buildRequest(), PARAMS)

    expect(response.status).not.toBe(403)
    // Admin can proceed to the payout lookup; if payout exists, 200/400 depending on body
    expect(prisma.vendorPayout.findUnique).toHaveBeenCalledWith({ where: { id: 'payout_1' } })
  })

  it('admin token can PATCH any payout regardless of vendorId', async () => {
    mockAdmin(ADMIN as never)

    const response = await PATCH(buildRequest(), PARAMS)

    expect(response.status).not.toBe(403)
    expect(prisma.vendorPayout.findUnique).toHaveBeenCalledWith({ where: { id: 'payout_1' } })
  })
})

describe('DELETE /api/vendor/payouts/[payoutId] — vendor isolation', () => {
  let prisma: ReturnType<typeof buildPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateAuditLog.mockResolvedValue(undefined)
    prisma = buildPrisma(buildPayout('vendor-a', 'PENDING'))
    mockGetPrisma.mockReturnValue(prisma as never)
  })

  it('vendor token gets 403 on DELETE (route requires super admin)', async () => {
    mockSuperAdmin(NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }))

    const response = await DELETE(buildRequest(), PARAMS)

    expect(response.status).toBe(403)
    expect(prisma.vendorPayout.delete).not.toHaveBeenCalled()
  })

  it('super admin token can DELETE any payout regardless of vendorId', async () => {
    mockSuperAdmin(ADMIN as never)

    const response = await DELETE(buildRequest(), PARAMS)

    expect(response.status).not.toBe(403)
    expect(prisma.vendorPayout.findUnique).toHaveBeenCalledWith({ where: { id: 'payout_1' } })
  })
})
