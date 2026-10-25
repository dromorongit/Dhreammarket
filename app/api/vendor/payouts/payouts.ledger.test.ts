import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextResponse } from 'next/server'

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

type SeedItem = { id: string; storeId: string; vendorEarnings: number | null; deliveredAt: Date | null; paymentStatus: string; orderStatus: string; source: string }

type SeedOptions = {
  stores?: { id: string; userId: string }[]
  users?: { id: string; role: string }[]
  payouts?: { id: string; vendorId: string; storeId: string; amount: number; status: string }[]
  items?: SeedItem[]
  adjustments?: { orderItemId: string; amount: number }[]
  eligibleSum?: number | null
}

function buildPrisma(seed: SeedOptions = {}) {
  const stores = seed.stores ?? [{ id: 'store-1', userId: 'vendor-1' }]
  const users = seed.users ?? [{ id: 'vendor-1', role: 'VENDOR' }]
  const payouts = seed.payouts ?? []
  const items = seed.items ?? []
  const adjustments = seed.adjustments ?? []
  const sum = seed.eligibleSum === undefined ? 100 : seed.eligibleSum

  const prisma: any = {
    store: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id !== undefined) return stores.find((s) => s.id === where.id) ?? null
        if (where.userId !== undefined) return stores.find((s) => s.userId === where.userId) ?? null
        return null
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.find((u) => u.id === where.id && (where.role === undefined || u.role === where.role)) ?? null),
    },
    orderItem: {
      aggregate: vi.fn(async () => ({ _sum: { vendorEarnings: sum } })),
      findMany: vi.fn(async ({ where }: any) => items.filter((it) => {
        if (where.product?.storeId !== undefined && it.storeId !== where.product.storeId) return false
        if (where.order?.paymentStatus !== undefined && it.paymentStatus !== where.order.paymentStatus) return false
        if (where.order?.status?.in !== undefined && !where.order.status.in.includes(it.orderStatus)) return false
        if (where.order?.source !== undefined && it.source !== where.order.source) return false
        if (where.deliveredAt?.not === null && it.deliveredAt === null) return false
        // hold boundary filter done in computeStoreBalance JS; here return all with deliveredAt not null
        return true
      }).map((it) => ({ id: it.id, vendorEarnings: it.vendorEarnings, deliveredAt: it.deliveredAt }))),
      count: vi.fn(async () => 0),
    },
    vendorPayout: {
      findMany: vi.fn(async ({ where, select }: any) => {
        const rows = payouts.filter((p) => {
          if (where.vendorId !== undefined && p.vendorId !== where.vendorId) return false
          if (where.storeId !== undefined && p.storeId !== where.storeId) return false
          if (where.status?.in !== undefined && !where.status.in.includes(p.status)) return false
          return true
        })
        return select ? rows.map((p) => ({ amount: p.amount })) : rows
      }),
      create: vi.fn(async ({ data }: any) => ({ id: 'payout_created', ...data })),
    },
    vendorBalanceAdjustment: {
      findMany: vi.fn(async ({ where }: any) => {
        const ids = where.orderItemId?.in ?? []
        return adjustments.filter((a) => ids.includes(a.orderItemId)).map((a) => ({ amount: a.amount }))
      }),
    },
    $transaction: vi.fn(async (arg: any) => (typeof arg === 'function' ? arg(prisma) : arg)),
    $queryRaw: vi.fn().mockResolvedValue([]),
  }
  return prisma
}

function buildRequest(body: unknown): any {
  return { cookies: { get: () => ({ value: 'token' }) }, json: async () => body }
}

function happySeed(overrides: SeedOptions = {}): SeedOptions {
  return {
    stores: [{ id: 'store-1', userId: 'vendor-1' }],
    users: [{ id: 'vendor-1', role: 'VENDOR' }],
    payouts: [],
    items: [],
    eligibleSum: 100,
    ...overrides,
  }
}

describe('payouts ledger', () => {
  let prisma: any
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireSuperAdmin.mockResolvedValue(SUPER_ADMIN as never)
    mockCreateAuditLog.mockResolvedValue(undefined)
    delete process.env.PAYOUT_LEDGER_MODE
    delete process.env.PAYOUT_HOLD_DAYS
  })
  afterEach(() => {
    delete process.env.PAYOUT_LEDGER_MODE
    delete process.env.PAYOUT_HOLD_DAYS
  })

  describe('mode off', () => {
    it('identical queries and no $transaction', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 100 }))
      mockGetPrisma.mockReturnValue(prisma)
      const res = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 50 }))
      expect(res.status).toBe(201)
      expect(prisma.orderItem.aggregate).toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('mode compare', () => {
    beforeEach(() => { process.env.PAYOUT_LEDGER_MODE = 'compare' })

    it('decisions equal old logic even when new balance differs; logs one line on difference', async () => {
      // new balance 0 (no items) vs old 100 => differ
      prisma = buildPrisma(happySeed({ eligibleSum: 100, items: [] }))
      mockGetPrisma.mockReturnValue(prisma)
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const res = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 50 }))
      expect(res.status).toBe(201)
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })

    it('no log when equal', async () => {
      const now = new Date()
      const item: SeedItem = { id: 'i1', storeId: 'store-1', vendorEarnings: 100, deliveredAt: new Date(now.getTime() - 10 * 86400000), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }
      prisma = buildPrisma(happySeed({ eligibleSum: 100, items: [item] }))
      mockGetPrisma.mockReturnValue(prisma)
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const res = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 50 }))
      expect(res.status).toBe(201)
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('throwing new calculation does not change response', async () => {
      prisma = buildPrisma(happySeed({ eligibleSum: 100, items: [] }))
      prisma.orderItem.findMany.mockRejectedValue(new Error('boom'))
      mockGetPrisma.mockReturnValue(prisma)
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const res = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 50 }))
      expect(res.status).toBe(201)
      spy.mockRestore()
    })
  })

  describe('mode enforce', () => {
    beforeEach(() => { process.env.PAYOUT_LEDGER_MODE = 'enforce' })

    it('refunded items not payable', async () => {
      const item: SeedItem = { id: 'i1', storeId: 'store-1', vendorEarnings: 100, deliveredAt: new Date(Date.now() - 10 * 86400000), paymentStatus: 'REFUNDED', orderStatus: 'DELIVERED', source: 'ONLINE' }
      prisma = buildPrisma(happySeed({ eligibleSum: 100, items: [item] }))
      mockGetPrisma.mockReturnValue(prisma)
      const res = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 50 }))
      const body = await res.json()
      expect(res.status).toBe(400)
      expect(body.availableEarnings).toBe(0)
    })

    it('held items not payable', async () => {
      const item: SeedItem = { id: 'i1', storeId: 'store-1', vendorEarnings: 100, deliveredAt: new Date(Date.now() - 1 * 86400000), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }
      process.env.PAYOUT_HOLD_DAYS = '7'
      prisma = buildPrisma(happySeed({ eligibleSum: 100, items: [item] }))
      mockGetPrisma.mockReturnValue(prisma)
      const res = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 50 }))
      const body = await res.json()
      expect(res.status).toBe(400)
      expect(body.availableEarnings).toBe(0)
    })

    it('amount between new and old available rejected with 400 and new availableEarnings', async () => {
      // old 100, new 40 (debit 60)
      const item: SeedItem = { id: 'i1', storeId: 'store-1', vendorEarnings: 100, deliveredAt: new Date(Date.now() - 10 * 86400000), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }
      prisma = buildPrisma(happySeed({ eligibleSum: 100, items: [item], adjustments: [{ orderItemId: 'i1', amount: -60 }] }))
      mockGetPrisma.mockReturnValue(prisma)
      const res = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 50 }))
      const body = await res.json()
      expect(res.status).toBe(400)
      expect(body.availableEarnings).toBe(40)
    })

    it('success writes one audit log after commit', async () => {
      const item: SeedItem = { id: 'i1', storeId: 'store-1', vendorEarnings: 100, deliveredAt: new Date(Date.now() - 10 * 86400000), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }
      prisma = buildPrisma(happySeed({ eligibleSum: 100, items: [item] }))
      mockGetPrisma.mockReturnValue(prisma)
      const res = await POST(buildRequest({ vendorId: 'vendor-1', storeId: 'store-1', amount: 100, reference: 'ref-1', note: 'note-1' }))
      expect(res.status).toBe(201)
      expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
    })
  })
})
