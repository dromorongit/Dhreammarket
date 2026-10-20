import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// Characterization tests for POST /api/vendor/payouts.
//
// Every test here asserts what the handler does TODAY. The tests whose names
// start with "CURRENT BEHAVIOUR (known gap):" pin behaviour that is known to
// be wrong; each of them has a matching it.todo at the bottom of this file
// that describes the behaviour the code SHOULD have.
//
// getVendorUnpaidEligibleEarnings is private to the route, so it is exercised
// through the exported POST handler with getPrisma, requireSuperAdmin and
// createAuditLog mocked. No database, no network and no environment secrets
// are involved.

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: vi.fn() }))
vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: vi.fn(),
  requireSuperAdmin: vi.fn(),
}))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'
import { POST } from '@/app/api/vendor/payouts/route'

const mockGetPrisma = vi.mocked(getPrisma)
const mockRequireSuperAdmin = vi.mocked(requireSuperAdmin)
const mockCreateAuditLog = vi.mocked(createAuditLog)

const SUPER_ADMIN = { userId: 'sa_1', role: 'SUPER_ADMIN' }

type SeedStore = { id: string; userId: string }
type SeedUser = { id: string; role: string }
type SeedPayout = {
  id: string
  vendorId: string
  storeId: string
  amount: number
  status: string
}

type SeedOptions = {
  stores?: SeedStore[]
  users?: SeedUser[]
  payouts?: SeedPayout[]
  /** The value the orderItem.aggregate sum returns. null means "no rows matched". */
  eligibleSum?: number | null
}

/**
 * A small in-memory stand-in for Prisma. It understands only the calls the
 * payout route makes, and it answers them the way the database would, so the
 * assertions describe behaviour rather than call counts alone.
 */
function buildPrisma(seed: SeedOptions = {}) {
  const stores = seed.stores ?? []
  const users = seed.users ?? []
  const payouts = seed.payouts ?? []
  const sum = seed.eligibleSum === undefined ? 0 : seed.eligibleSum

  const prisma = {
    store: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id !== undefined) return stores.find((s) => s.id === where.id) ?? null
        if (where.userId !== undefined) return stores.find((s) => s.userId === where.userId) ?? null
        return null
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        return (
          users.find((u) => u.id === where.id && (where.role === undefined || u.role === where.role)) ?? null
        )
      }),
    },
    orderItem: {
      aggregate: vi.fn(async (_args: any) => ({ _sum: { vendorEarnings: sum } })),
    },
    vendorPayout: {
      findMany: vi.fn(async ({ where, select }: any) => {
        const rows = payouts.filter((p) => {
          if (where.vendorId !== undefined && p.vendorId !== where.vendorId) return false
          if (where.status?.in !== undefined && !where.status.in.includes(p.status)) return false
          return true
        })
        return select ? rows.map((p) => ({ amount: p.amount })) : rows
      }),
      create: vi.fn(async ({ data }: any) => ({ id: 'payout_created', ...data })),
    },
    // Never touched by the route today. They exist here so the "known gap"
    // tests can prove they are NOT read.
    vendorPayoutItem: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    vendorBalanceAdjustment: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      aggregate: vi.fn(async () => ({ _sum: { amount: 0 } })),
    },
    $transaction: vi.fn(async (arg: any) => (typeof arg === 'function' ? arg(prisma) : arg)),
  }

  return prisma
}

/**
 * The route only reads the JSON body of the request, so a tiny stub is used
 * instead of a real NextRequest. That keeps values such as NaN and Infinity
 * intact, which JSON.stringify would turn into null.
 */
function buildRequest(body: unknown): any {
  return {
    cookies: { get: () => ({ value: 'token' }) },
    json: async () => body,
  }
}

function happySeed(overrides: SeedOptions = {}): SeedOptions {
  return {
    stores: [{ id: 'store-1', userId: 'vendor-1' }],
    users: [{ id: 'vendor-1', role: 'VENDOR' }],
    payouts: [],
    eligibleSum: 100,
    ...overrides,
  }
}

describe('POST /api/vendor/payouts', () => {
  let prisma: ReturnType<typeof buildPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireSuperAdmin.mockResolvedValue(SUPER_ADMIN as never)
    mockCreateAuditLog.mockResolvedValue(undefined)
    prisma = buildPrisma(happySeed())
    mockGetPrisma.mockReturnValue(prisma as never)
  })

  describe('authorisation', () => {
    it('returns the requireSuperAdmin Response unchanged when the caller is not a super admin', async () => {
      const denied = NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 })
      mockRequireSuperAdmin.mockResolvedValue(denied as never)

      const response = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 10 }))

      // The very same Response object comes back, so the status, the body and
      // any cookie the guard set are all preserved.
      expect(response).toBe(denied)
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'SUPER_ADMIN access required' })
      expect(mockGetPrisma).not.toHaveBeenCalled()
    })

    it('returns the 401 Response unchanged when nobody is signed in', async () => {
      const unauthenticated = NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      mockRequireSuperAdmin.mockResolvedValue(unauthenticated as never)

      const response = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 10 }))

      expect(response).toBe(unauthenticated)
      expect(response.status).toBe(401)
      expect(mockGetPrisma).not.toHaveBeenCalled()
    })
  })

  describe('amount validation', () => {
    const invalidAmounts: Array<[string, unknown]> = [
      ['a numeric string', '100'],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['zero', 0],
      ['a negative number', -25],
    ]

    it.each(invalidAmounts)('rejects %s as the payout amount with 400', async (_label, amount) => {
      const response = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Amount must be a positive finite number')
      // The amount is checked before anything is read from the database.
      expect(prisma.store.findUnique).not.toHaveBeenCalled()
      expect(prisma.vendorPayout.create).not.toHaveBeenCalled()
    })

    it('rejects a missing amount with 400', async () => {
      const response = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1' }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Amount must be a positive finite number')
      expect(prisma.vendorPayout.create).not.toHaveBeenCalled()
    })
  })

  describe('store resolution', () => {
    it('returns 404 when the given storeId does not resolve to a store', async () => {
      prisma = buildPrisma(happySeed({ stores: [] }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store_missing', amount: 10 }))
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error).toBe('Store not found')
      expect(prisma.store.findUnique).toHaveBeenCalledWith({ where: { id: 'store_missing' } })
      expect(prisma.vendorPayout.create).not.toHaveBeenCalled()
    })

    it('returns 404 when only a vendorId is given and that vendor has no store', async () => {
      prisma = buildPrisma(happySeed({ stores: [] }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(buildRequest({ vendorId: 'vendor-1', amount: 10 }))
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error).toBe('Store not found')
      expect(prisma.store.findUnique).toHaveBeenCalledWith({ where: { userId: 'vendor-1' } })
      expect(prisma.vendorPayout.create).not.toHaveBeenCalled()
    })

    it('returns 400 when the store does not belong to the given vendor', async () => {
      prisma = buildPrisma(
        happySeed({
          stores: [{ id: 'store-1', userId: 'vendor-2' }],
          users: [{ id: 'vendor-2', role: 'VENDOR' }],
        })
      )
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 10 }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Store does not belong to the specified vendor')
      expect(prisma.vendorPayout.create).not.toHaveBeenCalled()
    })
  })

  describe('vendor resolution', () => {
    it('returns 404 when the vendor user does not exist', async () => {
      prisma = buildPrisma(happySeed({ users: [] }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 10 }))
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error).toBe('Vendor not found')
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'vendor-1', role: 'VENDOR' } })
      expect(prisma.vendorPayout.create).not.toHaveBeenCalled()
    })

    it('returns 404 when the vendor user exists but is not a VENDOR', async () => {
      prisma = buildPrisma(happySeed({ users: [{ id: 'vendor-1', role: 'CUSTOMER' }] }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 10 }))
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error).toBe('Vendor not found')
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'vendor-1', role: 'VENDOR' } })
      expect(prisma.vendorPayout.create).not.toHaveBeenCalled()
    })
  })

  describe('eligibility', () => {
    it('sums vendorEarnings over PAID, DELIVERED or COMPLETED, ONLINE orders of this store only', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 500 }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 500, reference: 'ref-1', note: 'note-1' })
      )

      expect(response.status).toBe(201)
      expect(prisma.orderItem.aggregate).toHaveBeenCalledTimes(1)
      // The whole where clause is asserted, not just that a call happened.
      expect(prisma.orderItem.aggregate).toHaveBeenCalledWith({
        where: {
          product: {
            storeId: 'store-1',
          },
          order: {
            paymentStatus: 'PAID',
            status: {
              in: ['DELIVERED', 'COMPLETED'],
            },
            source: 'ONLINE',
          },
        },
        _sum: {
          vendorEarnings: true,
        },
      })
    })

    it('subtracts only payouts that are PENDING, PROCESSING or PAID', async () => {
      prisma = buildPrisma(
        happySeed({
          eligibleSum: 500,
          payouts: [
            { id: 'p1', vendorId: 'vendor-1', storeId: 'store-1', amount: 100, status: 'PENDING' },
            { id: 'p2', vendorId: 'vendor-1', storeId: 'store-1', amount: 50, status: 'PROCESSING' },
            { id: 'p3', vendorId: 'vendor-1', storeId: 'store-1', amount: 25, status: 'PAID' },
            { id: 'p4', vendorId: 'vendor-1', storeId: 'store-1', amount: 1000, status: 'FAILED' },
            { id: 'p5', vendorId: 'vendor-1', storeId: 'store-1', amount: 1000, status: 'CANCELLED' },
          ],
        })
      )
      mockGetPrisma.mockReturnValue(prisma as never)

      // 500 of earnings minus 100 + 50 + 25 = 325. The FAILED and CANCELLED
      // payouts are not subtracted, so 325 is still available.
      const response = await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 325, reference: 'ref-1', note: 'note-1' })
      )

      expect(response.status).toBe(201)
      expect(prisma.vendorPayout.findMany).toHaveBeenCalledTimes(1)
      expect(prisma.vendorPayout.findMany).toHaveBeenCalledWith({
        where: {
          vendorId: 'vendor-1',
          status: {
            in: ['PENDING', 'PROCESSING', 'PAID'],
          },
        },
        select: {
          amount: true,
        },
      })
    })

    it('returns 400 with availableEarnings when the amount exceeds the eligible earnings', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 100 }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 200, reference: 'ref-1', note: 'note-1' })
      )
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('Amount exceeds vendor available unpaid eligible earnings')
      expect(body.availableEarnings).toBe(100)
      expect(prisma.vendorPayout.create).not.toHaveBeenCalled()
    })

    it('creates the payout when the amount is exactly the eligible earnings', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 100 }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 100, reference: 'ref-1', note: 'note-1' })
      )
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body).toMatchObject({
        id: 'payout_created',
        vendorId: 'vendor-1',
        storeId: 'store-1',
        amount: 100,
        status: 'PENDING',
      })
      expect(prisma.vendorPayout.create).toHaveBeenCalledTimes(1)
      expect(prisma.vendorPayout.create).toHaveBeenCalledWith({
        data: {
          vendorId: 'vendor-1',
          storeId: 'store-1',
          amount: 100,
          status: 'PENDING',
          reference: 'ref-1',
          note: 'note-1',
        },
        include: {
          vendor: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          store: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
    })

    it('treats a null vendorEarnings sum as zero', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: null }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 1, reference: 'ref-1', note: 'note-1' })
      )
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.availableEarnings).toBe(0)
      expect(prisma.vendorPayout.create).not.toHaveBeenCalled()
    })

    it('clamps the eligible earnings to zero when existing payouts are larger than the earnings', async () => {
      prisma = buildPrisma(
        happySeed({
          eligibleSum: 100,
          payouts: [
            { id: 'p1', vendorId: 'vendor-1', storeId: 'store-1', amount: 500, status: 'PAID' },
          ],
        })
      )
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 1, reference: 'ref-1', note: 'note-1' })
      )
      const body = await response.json()

      expect(response.status).toBe(400)
      // Clamped, never negative.
      expect(body.availableEarnings).toBe(0)
      expect(prisma.vendorPayout.create).not.toHaveBeenCalled()
    })
  })

  describe('audit trail', () => {
    it('writes exactly one PAYOUT_CREATED audit log for a successful create', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 100 }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 100, reference: 'ref-1', note: 'note-1' })
      )

      expect(response.status).toBe(201)
      expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
      expect(mockCreateAuditLog).toHaveBeenCalledWith({
        userId: 'sa_1',
        userRole: 'SUPER_ADMIN',
        action: 'PAYOUT_CREATED',
        entityType: 'VENDOR_PAYOUT_METHOD',
        entityId: 'payout_created',
        afterData: expect.objectContaining({
          id: 'payout_created',
          vendorId: 'vendor-1',
          storeId: 'store-1',
          amount: 100,
          status: 'PENDING',
          reference: 'ref-1',
          note: 'note-1',
        }),
      })
    })

    it('writes no audit log when the payout is refused', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 100 }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 200, reference: 'ref-1', note: 'note-1' })
      )

      expect(response.status).toBe(400)
      expect(mockCreateAuditLog).not.toHaveBeenCalled()
    })
  })

  describe('CURRENT BEHAVIOUR (known gap)', () => {
    it('CURRENT BEHAVIOUR (known gap): refunded order items are still counted as eligible earnings', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 500 }))
      mockGetPrisma.mockReturnValue(prisma as never)

      await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 500, reference: 'ref-1', note: 'note-1' })
      )

      const where = prisma.orderItem.aggregate.mock.calls[0][0].where

      // The gap: the aggregate is filtered by store and by order state only.
      // Nothing looks at the Refund table, so an item whose money has already
      // been refunded still contributes its vendorEarnings to the amount the
      // vendor is allowed to withdraw.
      expect(Object.keys(where).sort()).toEqual(['order', 'product'])
      expect(JSON.stringify(where).toLowerCase()).not.toContain('refund')
      expect(where).not.toHaveProperty('refunds')
      expect(where.order).not.toHaveProperty('refunds')
      expect(where.product).not.toHaveProperty('refunds')
    })

    it('CURRENT BEHAVIOUR (known gap): there is no hold or dispute window before an order becomes eligible', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 500 }))
      mockGetPrisma.mockReturnValue(prisma as never)

      await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 500, reference: 'ref-1', note: 'note-1' })
      )

      const where = prisma.orderItem.aggregate.mock.calls[0][0].where
      const serialized = JSON.stringify(where).toLowerCase()

      // The gap: no time condition of any kind is applied, so an order that
      // was marked DELIVERED a moment ago is eligible on the very next
      // payout request. There is no window in which a customer can still
      // open a return or dispute.
      expect(serialized).not.toContain('gte')
      expect(serialized).not.toContain('lte')
      expect(serialized).not.toMatch(/deliveredat|updatedat|createdat|hold|dispute|days/)
      expect(where.order).not.toHaveProperty('deliveredAt')
      expect(where.order).not.toHaveProperty('updatedAt')
    })

    it('CURRENT BEHAVIOUR (known gap): the payout is created without any VendorPayoutItem rows', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 100 }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 100, reference: 'ref-1', note: 'note-1' })
      )

      expect(response.status).toBe(201)

      const createArg = prisma.vendorPayout.create.mock.calls[0][0]

      // The gap: the payout row is created on its own. Nothing records WHICH
      // order items the payout covers, so a payout cannot be reconciled
      // against the items it paid for.
      expect(Object.keys(createArg.data).sort()).toEqual([
        'amount',
        'note',
        'reference',
        'status',
        'storeId',
        'vendorId',
      ])
      expect(createArg.data).not.toHaveProperty('payoutItems')
      expect(createArg.include).not.toHaveProperty('payoutItems')
      expect(prisma.vendorPayoutItem.create).not.toHaveBeenCalled()
      expect(prisma.vendorPayoutItem.createMany).not.toHaveBeenCalled()
    })

    it('CURRENT BEHAVIOUR (known gap): the balance check and the payout create are not one transaction', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 100 }))
      mockGetPrisma.mockReturnValue(prisma as never)

      const response = await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 100, reference: 'ref-1', note: 'note-1' })
      )

      expect(response.status).toBe(201)

      // The gap: the earnings read and the write are two independent calls
      // with nothing in between that locks the rows, so two concurrent
      // requests can each see the full balance and both succeed.
      expect(prisma.$transaction).not.toHaveBeenCalled()
      expect(prisma.orderItem.aggregate.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.vendorPayout.create.mock.invocationCallOrder[0]
      )
    })

    it('CURRENT BEHAVIOUR (known gap): VendorBalanceAdjustment rows are never read when computing eligibility', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 100 }))
      mockGetPrisma.mockReturnValue(prisma as never)

      await POST(
        buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 100, reference: 'ref-1', note: 'note-1' })
      )

      // The gap: the balance adjustments that exist to claw money back from a
      // vendor are never consulted, so an adjusted balance is invisible to
      // the payout eligibility check.
      expect(prisma.vendorBalanceAdjustment.findMany).not.toHaveBeenCalled()
      expect(prisma.vendorBalanceAdjustment.findFirst).not.toHaveBeenCalled()
      expect(prisma.vendorBalanceAdjustment.aggregate).not.toHaveBeenCalled()
    })
  })

  describe('desired behaviour (not implemented yet)', () => {
    it.todo('excludes refunded order items from eligible earnings')
    it.todo('creates VendorPayoutItem rows in the same transaction as the payout')
    it.todo('rejects concurrent payout requests that together exceed eligible earnings')
    it.todo('subtracts VendorBalanceAdjustment amounts')
    it.todo('respects a dispute hold window')
  })
})
