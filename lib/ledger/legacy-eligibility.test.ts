import { describe, it, expect, vi } from 'vitest'
import { getLegacyEligibleEarnings } from './legacy-eligibility'

function buildClient(seed: any = {}) {
  const stores = seed.stores ?? [{ id: 'store-1', userId: 'vendor-1' }]
  const payouts = seed.payouts ?? []
  const sum = seed.eligibleSum === undefined ? 0 : seed.eligibleSum
  const client: any = {
    store: { findUnique: vi.fn(async ({ where }: any) => stores.find((s: any) => (where.id !== undefined && s.id === where.id) || (where.userId !== undefined && s.userId === where.userId)) ?? null) },
    orderItem: { aggregate: vi.fn(async () => ({ _sum: { vendorEarnings: sum } })) },
    vendorPayout: { findMany: vi.fn(async (args: any) => { const where = args?.where ?? {}; return payouts.filter((p: any) => p.vendorId === where.vendorId && where.status?.in?.includes(p.status)).map((p: any) => ({ amount: p.amount })) }) },
  }
  return client
}

describe('legacy eligibility', () => {
  it('issues the pinned where clause', async () => {
    const client = buildClient({ eligibleSum: 100 })
    await getLegacyEligibleEarnings(client, 'vendor-1')
    expect(client.orderItem.aggregate).toHaveBeenCalledWith({
      where: {
        product: { storeId: 'store-1' },
        order: { paymentStatus: 'PAID', status: { in: ['DELIVERED', 'COMPLETED'] }, source: 'ONLINE' },
      },
      _sum: { vendorEarnings: true },
    })
  })
  it('subtracts PENDING/PROCESSING/PAID payouts', async () => {
    const client = buildClient({ eligibleSum: 500, payouts: [
      { vendorId: 'vendor-1', amount: 100, status: 'PENDING' },
      { vendorId: 'vendor-1', amount: 50, status: 'PROCESSING' },
      { vendorId: 'vendor-1', amount: 25, status: 'PAID' },
      { vendorId: 'vendor-1', amount: 1000, status: 'FAILED' },
      { vendorId: 'vendor-1', amount: 1000, status: 'CANCELLED' },
    ]})
    const val = await getLegacyEligibleEarnings(client, 'vendor-1')
    expect(val).toBe(325)
  })
  it('clamps at zero', async () => {
    const client = buildClient({ eligibleSum: 100, payouts: [{ vendorId: 'vendor-1', amount: 500, status: 'PAID' }] })
    const val = await getLegacyEligibleEarnings(client, 'vendor-1')
    expect(val).toBe(0)
  })
  it('no store returns 0', async () => {
    const client = buildClient({ stores: [] })
    const val = await getLegacyEligibleEarnings(client, 'vendor-1')
    expect(val).toBe(0)
  })
})
