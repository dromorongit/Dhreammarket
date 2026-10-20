import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// Characterization tests for the LIVE payout status handlers in
// app/api/vendor/payouts/[payoutId]/route.ts.
//
// The same PATCH and DELETE handlers are also exported from
// app/api/vendor/payouts/route.ts. That copy is not what these tests cover:
// these tests describe the [payoutId] route, which is the one a request to
// /api/vendor/payouts/<id> reaches.
//
// Every assertion below describes what the code does TODAY.

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: vi.fn() }))
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

const ADMIN = { userId: 'admin-1', role: 'ADMIN' }
const SUPER_ADMIN = { userId: 'sa_1', role: 'SUPER_ADMIN' }

type PayoutStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED'

const ALL_STATUSES: PayoutStatus[] = ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED']

function buildPayout(status: PayoutStatus, overrides: Record<string, unknown> = {}) {
  return {
    id: 'payout_1',
    vendorId: 'vendor-1',
    storeId: 'store-1',
    amount: 100,
    status,
    reference: null,
    note: null,
    paidAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

/**
 * A minimal stand-in for Prisma covering only the calls the payout status
 * handlers make.
 */
function buildPrisma(payout: ReturnType<typeof buildPayout> | null) {
  return {
    vendorPayout: {
      findUnique: vi.fn(async () => payout),
      update: vi.fn(async ({ data }: any) => ({ ...(payout as object), ...data })),
      delete: vi.fn(async () => payout),
    },
  }
}

function buildRequest(body: unknown): any {
  return {
    cookies: { get: () => ({ value: 'token' }) },
    json: async () => body,
  }
}

const PARAMS = { params: { payoutId: 'payout_1' } }

describe('PATCH /api/vendor/payouts/[payoutId]', () => {
  let prisma: ReturnType<typeof buildPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN as never)
    mockRequireSuperAdmin.mockResolvedValue(SUPER_ADMIN as never)
    mockCreateAuditLog.mockResolvedValue(undefined)
    prisma = buildPrisma(buildPayout('PENDING'))
    mockGetPrisma.mockReturnValue(prisma as never)
  })

  describe('authorisation', () => {
    it('returns the requireAdmin Response unchanged when the caller is not an admin', async () => {
      const denied = NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      mockRequireAdmin.mockResolvedValue(denied as never)

      const response = await PATCH(buildRequest({ status: 'PAID' }), PARAMS)

      expect(response).toBe(denied)
      expect(response.status).toBe(403)
      expect(mockGetPrisma).not.toHaveBeenCalled()
    })

    it('returns the 401 Response unchanged when nobody is signed in', async () => {
      const unauthenticated = NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      mockRequireAdmin.mockResolvedValue(unauthenticated as never)

      const response = await PATCH(buildRequest({ status: 'PAID' }), PARAMS)

      expect(response).toBe(unauthenticated)
      expect(response.status).toBe(401)
      expect(mockGetPrisma).not.toHaveBeenCalled()
    })

    it('rejects a non-admin role', async () => {
      mockRequireAdmin.mockResolvedValue(
        NextResponse.json({ error: 'Admin access required' }, { status: 403 }) as never
      )

      const response = await PATCH(buildRequest({ status: 'PAID' }), PARAMS)

      expect(response.status).toBe(403)
      expect(prisma.vendorPayout.update).not.toHaveBeenCalled()
    })
  })

  it('returns 404 when the payout does not exist', async () => {
    prisma = buildPrisma(null)
    mockGetPrisma.mockReturnValue(prisma as never)

    const response = await PATCH(buildRequest({ status: 'PAID' }), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Payout not found')
    expect(prisma.vendorPayout.update).not.toHaveBeenCalled()
  })

  describe('allowed transitions', () => {
    const fromPending: PayoutStatus[] = ['PROCESSING', 'PAID', 'FAILED', 'CANCELLED']
    const fromProcessing: PayoutStatus[] = ['PAID', 'FAILED']

    it.each(fromPending)('allows PENDING to %s', async (target) => {
      prisma = buildPrisma(buildPayout('PENDING'))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await PATCH(buildRequest({ status: target }), PARAMS)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.status).toBe(target)
      expect(prisma.vendorPayout.update).toHaveBeenCalledTimes(1)
      expect(prisma.vendorPayout.update).toHaveBeenCalledWith({
        where: { id: 'payout_1' },
        data: {
          status: target,
          updatedAt: expect.any(Date),
          ...(target === 'PAID' ? { paidAt: expect.any(Date) } : {}),
        },
      })
    })

    it.each(fromProcessing)('allows PROCESSING to %s', async (target) => {
      prisma = buildPrisma(buildPayout('PROCESSING'))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await PATCH(buildRequest({ status: target }), PARAMS)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.status).toBe(target)
      expect(prisma.vendorPayout.update).toHaveBeenCalledTimes(1)
    })

    it('allows a payout to keep its current status', async () => {
      prisma = buildPrisma(buildPayout('PENDING'))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await PATCH(buildRequest({ status: 'PENDING' }), PARAMS)

      expect(response.status).toBe(200)
      expect(prisma.vendorPayout.update).toHaveBeenCalledWith({
        where: { id: 'payout_1' },
        data: {
          status: 'PENDING',
          updatedAt: expect.any(Date),
        },
      })
    })
  })

  describe('rejected transitions', () => {
    const terminal: PayoutStatus[] = ['PAID', 'FAILED', 'CANCELLED']

    it.each(terminal)('rejects every transition out of %s with 400', async (current) => {
      for (const target of ALL_STATUSES) {
        if (target === current) continue

        vi.clearAllMocks()
        mockRequireAdmin.mockResolvedValue(ADMIN as never)
        mockCreateAuditLog.mockResolvedValue(undefined)
        prisma = buildPrisma(buildPayout(current))
        mockGetPrisma.mockReturnValue(prisma as never)

        const response = await PATCH(buildRequest({ status: target }), PARAMS)
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error).toBe(`Disallowed status transition from ${current} to ${target}`)
        expect(prisma.vendorPayout.update).not.toHaveBeenCalled()
      }
    })

    it('rejects PROCESSING to CANCELLED with 400', async () => {
      prisma = buildPrisma(buildPayout('PROCESSING'))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await PATCH(buildRequest({ status: 'CANCELLED' }), PARAMS)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Disallowed status transition from PROCESSING to CANCELLED')
      expect(prisma.vendorPayout.update).not.toHaveBeenCalled()
    })
  })

  it('rejects an invalid status string with 400', async () => {
    const response = await PATCH(buildRequest({ status: 'NOT_A_STATUS' }), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Invalid status')
    expect(prisma.vendorPayout.update).not.toHaveBeenCalled()
  })

  describe('paidAt', () => {
    it('rejects a paidAt that is not accompanied by status PAID', async () => {
      const response = await PATCH(
        buildRequest({ status: 'PROCESSING', paidAt: '2026-02-01T00:00:00.000Z' }),
        PARAMS
      )
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('paidAt may only be set when status is PAID')
      expect(prisma.vendorPayout.update).not.toHaveBeenCalled()
    })

    it('rejects an explicit null paidAt when the status is not PAID', async () => {
      // The live handler tests `paidAt !== undefined`, so an explicit null is
      // treated as "a paidAt was supplied" and is refused.
      const response = await PATCH(buildRequest({ status: 'PENDING', paidAt: null }), PARAMS)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('paidAt may only be set when status is PAID')
      expect(prisma.vendorPayout.update).not.toHaveBeenCalled()
    })

    it('accepts an explicitly undefined paidAt when the status is not PAID', async () => {
      // The live handler tests `paidAt !== undefined`, so a body that carries
      // the key with an undefined value is NOT rejected. (The copy of this
      // handler in app/api/vendor/payouts/route.ts also tests
      // body.hasOwnProperty('paidAt') and would reject this body.)
      const response = await PATCH(buildRequest({ status: 'PENDING', paidAt: undefined }), PARAMS)

      expect(response.status).toBe(200)
      expect(prisma.vendorPayout.update).toHaveBeenCalledWith({
        where: { id: 'payout_1' },
        data: {
          status: 'PENDING',
          updatedAt: expect.any(Date),
        },
      })
    })

    it('stamps paidAt automatically when the status becomes PAID', async () => {
      prisma = buildPrisma(buildPayout('PENDING'))
      mockGetPrisma.mockReturnValue(prisma as never)

      const before = Date.now()
      const response = await PATCH(buildRequest({ status: 'PAID' }), PARAMS)
      const after = Date.now()

      expect(response.status).toBe(200)

      const updateArg = prisma.vendorPayout.update.mock.calls[0][0]
      expect(updateArg.data.paidAt).toBeInstanceOf(Date)
      const stamped = updateArg.data.paidAt.getTime()
      expect(stamped).toBeGreaterThanOrEqual(before)
      expect(stamped).toBeLessThanOrEqual(after)
    })

    it('keeps the supplied paidAt when the status becomes PAID', async () => {
      prisma = buildPrisma(buildPayout('PENDING'))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await PATCH(
        buildRequest({ status: 'PAID', paidAt: '2026-02-01T10:20:30.000Z' }),
        PARAMS
      )

      expect(response.status).toBe(200)
      expect(prisma.vendorPayout.update).toHaveBeenCalledWith({
        where: { id: 'payout_1' },
        data: {
          status: 'PAID',
          updatedAt: expect.any(Date),
          paidAt: new Date('2026-02-01T10:20:30.000Z'),
        },
      })
    })

    it('does not clear paidAt when a payout moves to a non-PAID status', async () => {
      prisma = buildPrisma(buildPayout('PROCESSING'))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await PATCH(buildRequest({ status: 'FAILED' }), PARAMS)

      expect(response.status).toBe(200)
      const updateArg = prisma.vendorPayout.update.mock.calls[0][0]
      expect(updateArg.data).not.toHaveProperty('paidAt')
    })
  })

  describe('audit trail', () => {
    it('writes one PAYOUT_STATUS_UPDATED audit log with the before and after data', async () => {
      const existing = buildPayout('PENDING')
      prisma = buildPrisma(existing)
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await PATCH(buildRequest({ status: 'PROCESSING' }), PARAMS)

      expect(response.status).toBe(200)
      expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
      expect(mockCreateAuditLog).toHaveBeenCalledWith({
        userId: 'admin-1',
        userRole: 'ADMIN',
        action: 'PAYOUT_STATUS_UPDATED',
        entityType: 'VENDOR_PAYOUT_METHOD',
        entityId: 'payout_1',
        beforeData: existing,
        afterData: expect.objectContaining({
          id: 'payout_1',
          status: 'PROCESSING',
        }),
      })
    })

    it('writes no audit log when the transition is rejected', async () => {
      prisma = buildPrisma(buildPayout('PAID'))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await PATCH(buildRequest({ status: 'PENDING' }), PARAMS)

      expect(response.status).toBe(400)
      expect(mockCreateAuditLog).not.toHaveBeenCalled()
    })
  })

  it('updates the reference and the note when they are supplied', async () => {
    prisma = buildPrisma(buildPayout('PENDING'))
    mockGetPrisma.mockReturnValue(prisma as never)

    const response = await PATCH(
      buildRequest({ status: 'PROCESSING', reference: 'PAYSTACK-REF-1', note: 'sent by hand' }),
      PARAMS
    )

    expect(response.status).toBe(200)
    expect(prisma.vendorPayout.update).toHaveBeenCalledWith({
      where: { id: 'payout_1' },
      data: {
        reference: 'PAYSTACK-REF-1',
        note: 'sent by hand',
        status: 'PROCESSING',
        updatedAt: expect.any(Date),
      },
    })
  })
})

describe('DELETE /api/vendor/payouts/[payoutId]', () => {
  let prisma: ReturnType<typeof buildPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN as never)
    mockRequireSuperAdmin.mockResolvedValue(SUPER_ADMIN as never)
    mockCreateAuditLog.mockResolvedValue(undefined)
    prisma = buildPrisma(buildPayout('PENDING'))
    mockGetPrisma.mockReturnValue(prisma as never)
  })

  describe('authorisation', () => {
    it('returns the requireSuperAdmin Response unchanged when the caller is not a super admin', async () => {
      const denied = NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 })
      mockRequireSuperAdmin.mockResolvedValue(denied as never)

      const response = await DELETE(buildRequest({}), PARAMS)

      expect(response).toBe(denied)
      expect(response.status).toBe(403)
      expect(mockGetPrisma).not.toHaveBeenCalled()
    })

    it('rejects a plain ADMIN, because DELETE needs SUPER_ADMIN', async () => {
      mockRequireSuperAdmin.mockResolvedValue(
        NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 }) as never
      )

      const response = await DELETE(buildRequest({}), PARAMS)

      expect(response.status).toBe(403)
      expect(prisma.vendorPayout.delete).not.toHaveBeenCalled()
    })
  })

  it('returns 404 when the payout does not exist', async () => {
    prisma = buildPrisma(null)
    mockGetPrisma.mockReturnValue(prisma as never)

    const response = await DELETE(buildRequest({}), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Payout not found')
    expect(prisma.vendorPayout.delete).not.toHaveBeenCalled()
  })

  it.each(['PENDING', 'CANCELLED'] as PayoutStatus[])('deletes a %s payout', async (status) => {
    prisma = buildPrisma(buildPayout(status))
    mockGetPrisma.mockReturnValue(prisma as never)

    const response = await DELETE(buildRequest({}), PARAMS)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(prisma.vendorPayout.delete).toHaveBeenCalledTimes(1)
    expect(prisma.vendorPayout.delete).toHaveBeenCalledWith({ where: { id: 'payout_1' } })
  })

  it.each(['PROCESSING', 'PAID', 'FAILED'] as PayoutStatus[])(
    'refuses to delete a %s payout with 400',
    async (status) => {
      prisma = buildPrisma(buildPayout(status))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await DELETE(buildRequest({}), PARAMS)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Only PENDING or CANCELLED payouts can be deleted')
      expect(body.currentStatus).toBe(status)
      expect(prisma.vendorPayout.delete).not.toHaveBeenCalled()
    }
  )

  it('writes one PAYOUT_DELETED audit log with the before data', async () => {
    const existing = buildPayout('PENDING')
    prisma = buildPrisma(existing)
    mockGetPrisma.mockReturnValue(prisma as never)

    const response = await DELETE(buildRequest({}), PARAMS)

    expect(response.status).toBe(200)
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      userId: 'sa_1',
      userRole: 'SUPER_ADMIN',
      action: 'PAYOUT_DELETED',
      entityType: 'VENDOR_PAYOUT_METHOD',
      entityId: 'payout_1',
      beforeData: existing,
    })
  })

  it('writes no audit log when the delete is refused', async () => {
    prisma = buildPrisma(buildPayout('PAID'))
    mockGetPrisma.mockReturnValue(prisma as never)

    const response = await DELETE(buildRequest({}), PARAMS)

    expect(response.status).toBe(400)
    expect(mockCreateAuditLog).not.toHaveBeenCalled()
  })
})
