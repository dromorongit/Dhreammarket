import { describe, it, expect, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { computeStoreBalance, computeAvailable, buildPayoutEligibilityComparison } from './payout-eligibility'

function D(v: any) { return new Prisma.Decimal(String(v)) }

interface SeedItem {
  id: string
  storeId: string
  vendorEarnings: number | null
  deliveredAt: Date | null
  paymentStatus: string
  orderStatus: string
  source: string
}
interface SeedAdj { id?: string; orderItemId: string; amount: number }
interface SeedPayout { id?: string; storeId: string | null; amount: number; status: string; vendorId?: string }

function buildClient(seed: { items?: SeedItem[]; adjustments?: SeedAdj[]; payouts?: SeedPayout[] } = {}) {
  const items = seed.items ?? []
  const adjustments = seed.adjustments ?? []
  const payouts = seed.payouts ?? []

  const client: any = {
    orderItem: {
      aggregate: vi.fn(async () => ({ _sum: { vendorEarnings: 0 } })),
      findMany: vi.fn(async (args: any) => {
        const where = args?.where ?? {}
        return items.filter((it) => {
          if (where.product?.storeId !== undefined && it.storeId !== where.product.storeId) return false
          if (where.order?.paymentStatus !== undefined && it.paymentStatus !== where.order.paymentStatus) return false
          if (where.order?.status?.in !== undefined && !where.order.status.in.includes(it.orderStatus)) return false
          if (where.order?.source !== undefined && it.source !== where.order.source) return false
          if (where.deliveredAt?.not === null && it.deliveredAt === null) return false
          return true
        }).map((it) => ({ id: it.id, vendorEarnings: it.vendorEarnings, deliveredAt: it.deliveredAt }))
      }),
      count: vi.fn(async ({ where }: any) => items.filter((it) => {
        if (where.product?.storeId !== undefined && it.storeId !== where.product.storeId) return false
        if (where.order?.status?.in !== undefined && !where.order.status.in.includes(it.orderStatus)) return false
        return true
      }).length),
    },
    vendorBalanceAdjustment: {
      findMany: vi.fn(async ({ where }: any) => {
        const ids = where.orderItemId?.in ?? []
        return adjustments.filter((a) => ids.includes(a.orderItemId)).map((a) => ({ amount: a.amount }))
      }),
    },
    vendorPayout: {
      findMany: vi.fn(async ({ where }: any) => {
        return payouts.filter((p) => {
          if (where?.OR) {
            const orMatch = where.OR.some((cond: any) => {
              if (cond.storeId !== undefined && p.storeId !== cond.storeId) return false
              if (cond.vendorId !== undefined && p.vendorId !== cond.vendorId) return false
              return true
            })
            if (!orMatch) return false
          } else {
            if (where?.storeId !== undefined && p.storeId !== where.storeId) return false
            if (where?.vendorId !== undefined && p.vendorId !== where.vendorId) return false
          }
          if (where?.status?.in !== undefined && !where.status.in.includes(p.status)) return false
          return true
        }).map((p) => ({ amount: p.amount }))
      }),
    },
    store: {
      findMany: vi.fn(async ({ take, cursor, skip }: any) => {
        // distinct stores from items
        const storeIds = Array.from(new Set(items.map((i) => i.storeId)))
        let start = 0
        if (cursor?.id) {
          const idx = storeIds.indexOf(cursor.id)
          start = idx >= 0 ? idx + (skip ?? 1) : 0
        }
        const page = storeIds.slice(start, start + (take ?? 50))
        return page.map((id) => ({ id, userId: 'vendor-' + id }))
      }),
      findUnique: vi.fn(async ({ where }: any) => ({ id: where.id ?? where.userId, userId: 'vendor-1' })),
    },
  }
  return client
}

const NOW = new Date('2026-10-25T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

describe('computeAvailable', () => {
  it('clamps at zero', () => {
    const r = computeAvailable(D(100), D(0), D(200))
    expect(r.net.toString()).toBe('-100')
    expect(r.available.toString()).toBe('0')
  })
  it('exact', () => {
    const r = computeAvailable(D(100), D(10), D(20))
    expect(r.available.toString()).toBe('70')
    expect(r.net.toString()).toBe('70')
  })
})

describe('computeStoreBalance', () => {
  it('baseline no refunds/debits/payouts with hold 0', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: new Date(NOW.getTime() - 1 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.credits.toString()).toBe('100')
    expect(b.debits.toString()).toBe('0')
    expect(b.paid.toString()).toBe('0')
    expect(b.available.toString()).toBe('100')
    expect(b.itemCount).toBe(1)
  })

  it('hold window: exactly holdDays ago eligible, one second earlier not', async () => {
    const atBoundary = new Date(NOW.getTime() - 7 * DAY)
    const oneSecLater = new Date(NOW.getTime() - 7 * DAY + 1000)
    const client = buildClient({
      items: [
        { id: 'i1', storeId: 's1', vendorEarnings: 10, deliveredAt: atBoundary, paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' },
        { id: 'i2', storeId: 's1', vendorEarnings: 20, deliveredAt: oneSecLater, paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' },
      ],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 7 })
    expect(b.itemCount).toBe(1)
    expect(b.credits.toString()).toBe('10')
  })

  it('null/future delivery excluded', async () => {
    const client = buildClient({
      items: [
        { id: 'i1', storeId: 's1', vendorEarnings: 10, deliveredAt: null, paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' },
        { id: 'i2', storeId: 's1', vendorEarnings: 20, deliveredAt: new Date(NOW.getTime() + DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' },
      ],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.itemCount).toBe(0)
    expect(b.credits.toString()).toBe('0')
  })

  it('partial refund debit reduces available', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
      adjustments: [{ orderItemId: 'i1', amount: -30 }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.debits.toString()).toBe('30')
    expect(b.available.toString()).toBe('70')
  })

  it('full refund: order REFUNDED drops out of S and debit not subtracted twice', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'REFUNDED', orderStatus: 'DELIVERED', source: 'ONLINE' }],
      adjustments: [{ orderItemId: 'i1', amount: -100 }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.itemCount).toBe(0)
    expect(b.credits.toString()).toBe('0')
    expect(b.debits.toString()).toBe('0')
    expect(b.available.toString()).toBe('0')
  })

  it('refund after vendor paid: available clamped 0, net negative carries', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
      payouts: [{ storeId: 's1', amount: 100, status: 'PAID' }],
      adjustments: [{ orderItemId: 'i1', amount: -40 }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    // credits 100 - debits 40 - paid 100 = -40
    expect(b.net.toString()).toBe('-40')
    expect(b.available.toString()).toBe('0')
  })

  it('debit on item inside hold window ignored until item enters S', async () => {
    const recent = new Date(NOW.getTime() - 1 * DAY)
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: recent, paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
      adjustments: [{ orderItemId: 'i1', amount: -50 }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 7 })
    // item not eligible yet => no credits, no debits
    expect(b.itemCount).toBe(0)
    expect(b.credits.toString()).toBe('0')
    expect(b.debits.toString()).toBe('0')
  })

  it('FAILED and CANCELLED payouts not subtracted', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
      payouts: [
        { storeId: 's1', amount: 10, status: 'FAILED' },
        { storeId: 's1', amount: 10, status: 'CANCELLED' },
        { storeId: 's1', amount: 20, status: 'PENDING' },
      ],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.paid.toString()).toBe('20')
    expect(b.available.toString()).toBe('80')
  })

  it('decimal exactness', async () => {
    const client = buildClient({
      items: [
        { id: 'i1', storeId: 's1', vendorEarnings: 0.1, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' },
        { id: 'i2', storeId: 's1', vendorEarnings: 0.2, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' },
      ],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.credits.toString()).toBe('0.3')
  })

  it('property: per item debit never exceeds vendorEarnings and available non-negative <= credits', async () => {
    // seeded generator simple loop
    for (let i = 0; i < 20; i++) {
      const ve = Math.round(Math.random() * 10000) / 100
      const debit = Math.round(Math.random() * ve * 100) / 100
      const client = buildClient({
        items: [{ id: 'i1', storeId: 's1', vendorEarnings: ve, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
        adjustments: [{ orderItemId: 'i1', amount: -debit }],
      })
      const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
      const credits = Number(b.credits.toString())
      const available = Number(b.available.toString())
      expect(available).toBeGreaterThanOrEqual(0)
      expect(available).toBeLessThanOrEqual(credits + 1e-9)
    }
  })
})

describe('paid scoping (conservative, never subtract less)', () => {
  it('legacy payout with null storeId is still subtracted', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
      payouts: [{ storeId: null, amount: 30, status: 'PAID', vendorId: 'vendor-1' }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.paid.toString()).toBe('30')
    expect(b.available.toString()).toBe('70')
  })

  it('payout in another store of the same vendor is subtracted (documented conservative choice)', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
      payouts: [{ storeId: 's2', amount: 40, status: 'PENDING', vendorId: 'vendor-1' }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.paid.toString()).toBe('40')
    expect(b.available.toString()).toBe('60')
  })

  it('table-driven: new paid >= old paid for PENDING/PROCESSING/PAID', async () => {
    const cases: { payouts: SeedPayout[] }[] = [
      { payouts: [] },
      { payouts: [{ storeId: 's1', amount: 10, status: 'PENDING', vendorId: 'vendor-1' }] },
      { payouts: [{ storeId: 's1', amount: 10, status: 'PROCESSING', vendorId: 'vendor-1' }, { storeId: 's1', amount: 5, status: 'PAID', vendorId: 'vendor-1' }] },
      { payouts: [{ storeId: 's1', amount: 5, status: 'FAILED', vendorId: 'vendor-1' }, { storeId: 's1', amount: 7, status: 'CANCELLED', vendorId: 'vendor-1' }] },
      { payouts: [{ storeId: null, amount: 12, status: 'PAID', vendorId: 'vendor-1' }] },
      { payouts: [{ storeId: 's2', amount: 8, status: 'PENDING', vendorId: 'vendor-1' }] },
    ]
    for (const c of cases) {
      const client = buildClient({
        items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
        payouts: c.payouts,
      })
      const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
      // legacy paid = sum of PENDING/PROCESSING/PAID by vendorId
      const legacyPaid = (c.payouts ?? [])
        .filter((p) => ['PENDING', 'PROCESSING', 'PAID'].includes(p.status) && p.vendorId === 'vendor-1')
        .reduce((s, p) => s + p.amount, 0)
      expect(Number(b.paid.toString())).toBeGreaterThanOrEqual(legacyPaid)
    }
  })
})

describe('signed debits', () => {
  it('positive adjustment offsets a REFUND_CLAWBACK', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
      adjustments: [
        { orderItemId: 'i1', amount: -30 }, // REFUND_CLAWBACK (debit)
        { orderItemId: 'i1', amount: 10 },  // credit
      ],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    // debits = -(-30 + 10) = 20
    expect(b.debits.toString()).toBe('20')
    expect(b.available.toString()).toBe('80')
  })

  it('positive-only adjustment never reduces available below credits minus paid', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
      adjustments: [{ orderItemId: 'i1', amount: 10 }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    // debits = -10; available = 100 - (-10) = 110 >= 100
    expect(b.debits.toString()).toBe('-10')
    expect(Number(b.available.toString())).toBeGreaterThanOrEqual(100)
  })
})

describe('buildPayoutEligibilityComparison', () => {
  it('builds report', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: new Date(NOW.getTime() - 10 * DAY), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
    })
    const r = await buildPayoutEligibilityComparison(client, { limit: 50 })
    expect(r.summary.storesChecked).toBe(1)
    expect(r.stores[0].storeId).toBe('s1')
  })
})
