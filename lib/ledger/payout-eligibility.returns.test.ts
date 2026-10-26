import { describe, it, expect, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { computeStoreBalance } from './payout-eligibility'

function D(v: any) { return new Prisma.Decimal(String(v)) }

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-25T12:00:00.000Z')
const OLD = new Date(NOW.getTime() - 10 * DAY)

type SeedItem = {
  id: string
  storeId: string
  vendorEarnings: number | null
  deliveredAt: Date | null
  orderStatus: string
  paymentStatus: string
  source: string
}

function buildClient(seed: {
  items?: SeedItem[]
  returns?: { orderItemId: string; status: string }[]
  adjustments?: { orderItemId: string; amount: number }[]
  payouts?: { amount: number; status: string }[]
} = {}) {
  const items = seed.items ?? []
  const returns = seed.returns ?? []
  const adjustments = seed.adjustments ?? []
  const payouts = seed.payouts ?? []

  const client: any = {
    orderItem: {
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
    },
    returnRequest: {
      findMany: vi.fn(async (args: any) => {
        const where = args?.where ?? {}
        const ids = where.orderItemId?.in ?? []
        return returns.filter((r) => ids.includes(r.orderItemId) && where.status?.in.includes(r.status)).map((r) => ({ orderItemId: r.orderItemId }))
      }),
    },
    vendorBalanceAdjustment: {
      findMany: vi.fn(async ({ where }: any) => {
        const ids = where.orderItemId?.in ?? []
        return adjustments.filter((a) => ids.includes(a.orderItemId)).map((a) => ({ amount: a.amount }))
      }),
    },
    store: {
      findUnique: vi.fn(async ({ where }: any) => ({ id: where.id, userId: 'vendor-1' })),
    },
    vendorPayout: {
      findMany: vi.fn(async ({ where }: any) => {
        return payouts.filter((p) => {
          if (where?.status?.in !== undefined && !where.status.in.includes(p.status)) return false
          return true
        }).map((p) => ({ amount: p.amount }))
      }),
    },
  }
  return client
}

describe('payout-eligibility return hold', () => {
  it('excludes an item with an open return from credits and debits', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: OLD, orderStatus: 'DELIVERED', paymentStatus: 'PAID', source: 'ONLINE' }],
      returns: [{ orderItemId: 'i1', status: 'PENDING' }],
      adjustments: [{ orderItemId: 'i1', amount: -30 }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.itemCount).toBe(0)
    expect(b.credits.toString()).toBe('0')
    expect(b.debits.toString()).toBe('0')
  })

  it('includes the item again once the return closes (terminal status)', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: OLD, orderStatus: 'DELIVERED', paymentStatus: 'PAID', source: 'ONLINE' }],
      returns: [{ orderItemId: 'i1', status: 'REJECTED' }],
      adjustments: [{ orderItemId: 'i1', amount: -30 }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.itemCount).toBe(1)
    expect(b.credits.toString()).toBe('100')
    expect(b.debits.toString()).toBe('30')
  })

  it('denied or completed requests do not hold', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: OLD, orderStatus: 'DELIVERED', paymentStatus: 'PAID', source: 'ONLINE' }],
      returns: [
        { orderItemId: 'i1', status: 'REJECTED' },
        { orderItemId: 'i1', status: 'CLOSED' },
      ],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.itemCount).toBe(1)
    expect(b.credits.toString()).toBe('100')
  })

  it('items without returns are unaffected', async () => {
    const client = buildClient({
      items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: OLD, orderStatus: 'DELIVERED', paymentStatus: 'PAID', source: 'ONLINE' }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.itemCount).toBe(1)
    expect(b.credits.toString()).toBe('100')
  })

  it('only open non-terminal statuses hold funds', async () => {
    for (const status of ['PENDING', 'ITEM_IN_TRANSIT', 'ITEM_RECEIVED', 'AWAITING_REFUND', 'ESCALATED']) {
      const client = buildClient({
        items: [{ id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: OLD, orderStatus: 'DELIVERED', paymentStatus: 'PAID', source: 'ONLINE' }],
        returns: [{ orderItemId: 'i1', status }],
      })
      const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
      expect(b.itemCount).toBe(0)
      expect(b.credits.toString()).toBe('0')
    }
  })

  it('a return on one item does not hold another item', async () => {
    const client = buildClient({
      items: [
        { id: 'i1', storeId: 's1', vendorEarnings: 100, deliveredAt: OLD, orderStatus: 'DELIVERED', paymentStatus: 'PAID', source: 'ONLINE' },
        { id: 'i2', storeId: 's1', vendorEarnings: 50, deliveredAt: OLD, orderStatus: 'DELIVERED', paymentStatus: 'PAID', source: 'ONLINE' },
      ],
      returns: [{ orderItemId: 'i1', status: 'PENDING' }],
    })
    const b = await computeStoreBalance(client, { storeId: 's1', now: NOW, holdDays: 0 })
    expect(b.itemCount).toBe(1)
    expect(b.credits.toString()).toBe('50')
  })
})
