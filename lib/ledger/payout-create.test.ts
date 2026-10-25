import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { createPayoutWithinLedger } from './payout-create'

function D(v: any) { return new Prisma.Decimal(String(v)) }

function buildClient(seed: any = {}) {
  const items = seed.items ?? []
  const adjustments = seed.adjustments ?? []
  const payouts = seed.payouts ?? []
  const stores = seed.stores ?? [{ id: 'store-1', userId: 'vendor-1' }]

  const tx: any = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    store: { findUnique: vi.fn(async () => stores[0]) },
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
        }).map((it: any) => ({ id: it.id, vendorEarnings: it.vendorEarnings, deliveredAt: it.deliveredAt }))
      }),
    },
    vendorBalanceAdjustment: {
      findMany: vi.fn(async (args: any) => {
        const where = args?.where ?? {}
        const ids = where.orderItemId?.in ?? []
        return adjustments.filter((a: any) => ids.includes(a.orderItemId)).map((a: any) => ({ amount: a.amount }))
      }),
    },
    vendorPayout: {
      findMany: vi.fn(async (args: any) => {
        const where = args?.where ?? {}
        return payouts.filter((p: any) => {
          if (where.storeId !== undefined && p.storeId !== where.storeId) return false
          if (where.status?.in !== undefined && !where.status.in.includes(p.status)) return false
          return true
        }).map((p: any) => ({ amount: p.amount }))
      }),
      create: vi.fn(async (args: any) => ({ id: 'payout_created', ...(args?.data ?? {}) })),
    },
  }
  // transaction runs callback with tx
  const client: any = {
    $transaction: vi.fn(async (cb: any) => cb(tx)),
    ...tx,
  }
  // store findUnique at top level not needed in create
  client.store = { findUnique: vi.fn(async () => stores[0]) }
  return { client, tx }
}

describe('createPayoutWithinLedger', () => {
  it('lock issued before balance read', async () => {
    const { client, tx } = buildClient({
      items: [{ id: 'i1', storeId: 'store-1', vendorEarnings: 100, deliveredAt: new Date(Date.now() - 10 * 86400000), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
    })
    // track call order
    const order: string[] = []
    tx.$queryRaw.mockImplementation(async () => { order.push('lock'); return [] })
    const origFindMany = tx.orderItem.findMany
    tx.orderItem.findMany = vi.fn(async (...a: any[]) => { order.push('balance'); return origFindMany(...a) })
    await createPayoutWithinLedger(client, { vendorId: 'vendor-1', storeId: 'store-1', amount: 50 })
    expect(order[0]).toBe('lock')
    expect(order[1]).toBe('balance')
  })

  it('uses transaction client for balance and create', async () => {
    const { client, tx } = buildClient({
      items: [{ id: 'i1', storeId: 'store-1', vendorEarnings: 100, deliveredAt: new Date(Date.now() - 10 * 86400000), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
    })
    await createPayoutWithinLedger(client, { vendorId: 'vendor-1', storeId: 'store-1', amount: 50 })
    expect(tx.vendorPayout.create).toHaveBeenCalled()
    expect(client.$transaction).toHaveBeenCalled()
  })

  it('two sequential calls exceeding available: second rejected', async () => {
    const seed: any = { items: [{ id: 'i1', storeId: 'store-1', vendorEarnings: 100, deliveredAt: new Date(Date.now() - 10 * 86400000), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }], payouts: [] }
    const { client, tx } = buildClient(seed)
    // first call creates payout; simulate by pushing payout into payouts after first
    const r1 = await createPayoutWithinLedger(client, { vendorId: 'vendor-1', storeId: 'store-1', amount: 60 })
    expect(r1.ok).toBe(true)
    // now make payouts include the created one
    seed.payouts.push({ storeId: 'store-1', amount: 60, status: 'PENDING' })
    const r2 = await createPayoutWithinLedger(client, { vendorId: 'vendor-1', storeId: 'store-1', amount: 60 })
    expect(r2.ok).toBe(false)
    if (!r2.ok && r2.reason === 'EXCEEDS_AVAILABLE') {
      expect(Number(r2.available.toString())).toBe(40)
    }
  })

  it('exactly-equal succeeds, one pesewa more rejected', async () => {
    const { client } = buildClient({
      items: [{ id: 'i1', storeId: 'store-1', vendorEarnings: 100, deliveredAt: new Date(Date.now() - 10 * 86400000), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
    })
    const r1 = await createPayoutWithinLedger(client, { vendorId: 'vendor-1', storeId: 'store-1', amount: 100 })
    expect(r1.ok).toBe(true)
    const r2 = await createPayoutWithinLedger(client, { vendorId: 'vendor-1', storeId: 'store-1', amount: 100.01 })
    expect(r2.ok).toBe(false)
  })

  it('lock keyed on store id', async () => {
    const { client, tx } = buildClient({
      items: [{ id: 'i1', storeId: 'store-2', vendorEarnings: 100, deliveredAt: new Date(Date.now() - 10 * 86400000), paymentStatus: 'PAID', orderStatus: 'DELIVERED', source: 'ONLINE' }],
    })
    await createPayoutWithinLedger(client, { vendorId: 'vendor-1', storeId: 'store-2', amount: 10 })
    expect(tx.$queryRaw).toHaveBeenCalled()
    // the interpolated store id is the second arg
    expect(tx.$queryRaw.mock.calls[0][1]).toBe('store-2')
  })

  it('invalid amount rejected without transaction', async () => {
    const { client } = buildClient({})
    const r = await createPayoutWithinLedger(client, { vendorId: 'vendor-1', storeId: 'store-1', amount: 10.123 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('INVALID_AMOUNT')
    expect(client.$transaction).not.toHaveBeenCalled()
  })
})
