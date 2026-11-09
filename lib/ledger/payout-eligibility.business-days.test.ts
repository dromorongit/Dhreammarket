import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { computeStoreBalance } from './payout-eligibility'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
const mockGetPrisma = vi.mocked(getPrisma)

function D(v: any) { return new Prisma.Decimal(String(v)) }

const CUTOVER = new Date('2026-09-01T00:00:00.000Z')
const FRIDAY = new Date('2026-10-23T17:00:00.000Z')
const TUESDAY = new Date('2026-10-27T17:00:00.000Z')

function buildClient(seed: { items?: any[]; policy?: any; openReturns?: string[] } = {}) {
  const items = seed.items ?? []
  const openReturns = seed.openReturns ?? []
  const mockPrisma = {
    platformPolicy: {
      findUnique: vi.fn(async () => seed.policy ?? { systemCutoverTimestamp: CUTOVER, holidayList: [] }),
    },
  }
  mockGetPrisma.mockReturnValue(mockPrisma as any)

  const client: any = {
    orderItem: {
      findMany: vi.fn(async (args: any) => {
        const where = args?.where ?? {}
        return items.filter((it: any) => {
          if (where.product?.storeId !== undefined && it.storeId !== where.product.storeId) return false
          if (where.order?.paymentStatus !== undefined && it.paymentStatus !== where.order.paymentStatus) return false
          if (where.order?.status?.in !== undefined && !where.order.status.in.includes(it.orderStatus)) return false
          if (where.order?.source !== undefined && it.source !== where.order.source) return false
          if (where.deliveredAt?.not === null && it.deliveredAt === null) return false
          return true
        }).map((it: any) => ({
          id: it.id,
          vendorEarnings: it.vendorEarnings,
          deliveredAt: it.deliveredAt,
          order: it.order ? { createdAt: it.order.createdAt, completedAt: it.order.completedAt } : undefined,
        }))
      }),
    },
    vendorBalanceAdjustment: { findMany: vi.fn(async () => []) },
    vendorPayout: { findMany: vi.fn(async () => []) },
    store: { findUnique: vi.fn(async () => ({ userId: 'vendor-1' })) },
    returnRequest: {
      findMany: vi.fn(async ({ where }: any) => {
        const ids = where.orderItemId?.in ?? []
        const statuses = where.status?.in ?? []
        return openReturns
          .filter((id: string) => ids.includes(id))
          .map((id: string) => ({ orderItemId: id, status: statuses[0] ?? 'PENDING' }))
      }),
    },
  }
  return { client, mockPrisma }
}

const baseItem = (overrides: any = {}) => ({
  id: 'i1',
  storeId: 's1',
  vendorEarnings: 100,
  deliveredAt: new Date('2026-10-23T10:00:00.000Z'),
  paymentStatus: 'PAID',
  orderStatus: 'DELIVERED',
  source: 'ONLINE',
  ...overrides,
})

describe('computeStoreBalance business-day payouts (flag on)', () => {
  beforeEach(() => {
    process.env.BUSINESS_DAY_PAYOUT_ENABLED = 'true'
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.BUSINESS_DAY_PAYOUT_ENABLED
  })

  it('Friday 17:00 completed is eligible on Tuesday 17:00, not before', async () => {
    const item = baseItem({
      order: { createdAt: new Date('2026-09-10T00:00:00.000Z'), completedAt: FRIDAY },
    })
    const client = buildClient({ items: [item] }).client

    const eligible = await computeStoreBalance(client, { storeId: 's1', now: TUESDAY })
    expect(eligible.itemCount).toBe(1)
    expect(eligible.credits.toString()).toBe('100')

    const notYet = await computeStoreBalance(client, { storeId: 's1', now: new Date(TUESDAY.getTime() - 1) })
    expect(notYet.itemCount).toBe(0)
    expect(notYet.credits.toString()).toBe('0')
  })

  it('Thursday completed is eligible on Monday', async () => {
    const thursday = new Date('2026-10-22T10:00:00.000Z')
    const monday = new Date('2026-10-26T10:00:00.000Z')
    const item = baseItem({
      order: { createdAt: new Date('2026-09-10T00:00:00.000Z'), completedAt: thursday },
    })
    const client = buildClient({ items: [item] }).client
    const b = await computeStoreBalance(client, { storeId: 's1', now: monday })
    expect(b.itemCount).toBe(1)
    expect(b.credits.toString()).toBe('100')
  })

  it('holiday Monday pushes Friday completion to Wednesday', async () => {
    const item = baseItem({
      order: { createdAt: new Date('2026-09-10T00:00:00.000Z'), completedAt: FRIDAY },
    })
    const client = buildClient({
      items: [item],
      policy: { systemCutoverTimestamp: CUTOVER, holidayList: ['2026-10-26'] },
    }).client
    const wednesday = new Date('2026-10-28T17:00:00.000Z')
    const b = await computeStoreBalance(client, { storeId: 's1', now: wednesday })
    expect(b.itemCount).toBe(1)
    expect(b.credits.toString()).toBe('100')

    const tuesday = new Date('2026-10-27T17:00:00.000Z')
    const notYet = await computeStoreBalance(client, { storeId: 's1', now: tuesday })
    expect(notYet.itemCount).toBe(0)
  })

  it('completedAt null is not eligible', async () => {
    const item = baseItem({
      order: { createdAt: new Date('2026-09-10T00:00:00.000Z'), completedAt: null },
    })
    const client = buildClient({ items: [item] }).client
    const b = await computeStoreBalance(client, { storeId: 's1', now: TUESDAY })
    expect(b.itemCount).toBe(0)
    expect(b.credits.toString()).toBe('0')
  })

  it('open return request blocks release', async () => {
    const item = baseItem({
      order: { createdAt: new Date('2026-09-10T00:00:00.000Z'), completedAt: FRIDAY },
    })
    const client = buildClient({ items: [item], openReturns: ['i1'] }).client
    const b = await computeStoreBalance(client, { storeId: 's1', now: TUESDAY })
    expect(b.itemCount).toBe(0)
    expect(b.credits.toString()).toBe('0')
  })

  it('pre-cutover order keeps deliveredAt hold behaviour', async () => {
    const item = baseItem({
      deliveredAt: new Date('2026-10-20T10:00:00.000Z'),
      order: { createdAt: new Date('2026-08-01T00:00:00.000Z'), completedAt: FRIDAY },
    })
    const client = buildClient({ items: [item] }).client
    // holdDays default 7; deliveredAt Oct 20 + 7d = Oct 27. Eligible Oct 27.
    const b = await computeStoreBalance(client, { storeId: 's1', now: TUESDAY })
    expect(b.itemCount).toBe(1)
    expect(b.credits.toString()).toBe('100')
  })
})

describe('computeStoreBalance flag off behaves as before', () => {
  beforeEach(() => {
    delete process.env.BUSINESS_DAY_PAYOUT_ENABLED
    vi.clearAllMocks()
  })

  it('ignores completedAt and uses deliveredAt hold', async () => {
    const item = baseItem({
      deliveredAt: new Date('2026-10-20T10:00:00.000Z'),
      order: { createdAt: new Date('2026-09-10T00:00:00.000Z'), completedAt: FRIDAY },
    })
    const client = buildClient({ items: [item] }).client
    const b = await computeStoreBalance(client, { storeId: 's1', now: TUESDAY, holdDays: 7 })
    expect(b.itemCount).toBe(1)
    expect(b.credits.toString()).toBe('100')
  })
})
