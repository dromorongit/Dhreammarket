import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadSellerTrustProfile } from './load-profile'

function makeClient(overrides: any = {}) {
  const calls: any[] = []
  const client: any = {
    store: {
      findUnique: vi.fn(async (args: any) => {
        calls.push({ delegate: 'store', method: 'findUnique', args })
        if (overrides.store === undefined) {
          return {
            id: 'store-1',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            userId: 'vendor-1',
            isVerified: true,
            updatedAt: new Date('2024-06-01T00:00:00Z'),
            verificationApplications: [{ status: 'APPROVED', updatedAt: new Date('2024-06-01T00:00:00Z') }],
          }
        }
        return overrides.store
      }),
    },
    order: {
      count: vi.fn(async (args: any) => {
        calls.push({ delegate: 'order', method: 'count', args })
        return overrides.orderCount ?? 0
      }),
      findFirst: vi.fn(async (args: any) => {
        calls.push({ delegate: 'order', method: 'findFirst', args })
        return overrides.firstOrder ?? null
      }),
      findMany: vi.fn(async () => []),
    },
    orderItem: {
      findMany: vi.fn(async (args: any) => {
        calls.push({ delegate: 'orderItem', method: 'findMany', args })
        return overrides.deliveryItems ?? []
      }),
    },
    returnRequest: {
      count: vi.fn(async (args: any) => {
        calls.push({ delegate: 'returnRequest', method: 'count', args })
        return overrides.returnCount ?? 0
      }),
    },
    productReview: {
      aggregate: vi.fn(async (args: any) => {
        calls.push({ delegate: 'productReview', method: 'aggregate', args })
        return { _count: { _all: overrides.productReviewCount ?? 0 }, _sum: { rating: overrides.productReviewSum ?? 0 } }
      }),
    },
    vendorReview: {
      aggregate: vi.fn(async (args: any) => {
        calls.push({ delegate: 'vendorReview', method: 'aggregate', args })
        return { _count: { _all: overrides.vendorReviewCount ?? 0 }, _sum: { rating: overrides.vendorReviewSum ?? 0 } }
      }),
    },
  }
  return { client, calls }
}

describe('loadSellerTrustProfile', () => {
  it('missing store returns not found', async () => {
    const { client, calls } = makeClient({ store: null })
    const res = await loadSellerTrustProfile(client, { storeId: 'nope', now: new Date() })
    expect(res.found).toBe(false)
    const writes = calls.filter((c) => /create|update|delete|upsert/.test(c.method))
    expect(writes.length).toBe(0)
  })

  it('empty store yields insufficient data, no exceptions', async () => {
    const { client } = makeClient({ orderCount: 0, deliveryItems: [], returnCount: 0, firstOrder: null, productReviewCount: 0, vendorReviewCount: 0 })
    const res = await loadSellerTrustProfile(client, { storeId: 'store-1', now: new Date('2025-01-01T00:00:00Z') })
    expect(res.found).toBe(true)
    if (res.found) {
      expect(res.data.completedInWindow).toBe(0)
      expect(res.data.reviewCount).toBe(0)
    }
  })

  it('where clauses include paid, status sets, window, verified restriction, seller-fault reasons', async () => {
    const now = new Date('2025-01-10T00:00:00Z')
    const { client, calls } = makeClient({ orderCount: 5 })
    await loadSellerTrustProfile(client, { storeId: 'store-1', now })
    const orderCountCall = calls.find((c) => c.delegate === 'order' && c.method === 'count')
    expect(orderCountCall.args.where.paymentStatus).toBe('PAID')
    expect(orderCountCall.args.where.status.in).toEqual(['DELIVERED', 'COMPLETED'])
    expect(orderCountCall.args.where.createdAt).toBeDefined()
    const returnCall = calls.find((c) => c.delegate === 'returnRequest' && c.method === 'count')
    expect(returnCall.args.where.reason.in).toContain('NOT_AS_DESCRIBED')
    expect(returnCall.args.where.reason.in).toContain('DAMAGED')
    const productAgg = calls.find((c) => c.delegate === 'productReview' && c.method === 'aggregate')
    expect(productAgg.args.where.orderId).toEqual({ not: null })
    expect(productAgg.args.where.userId).toEqual({ not: 'vendor-1' })
    expect(productAgg.args.where.isApproved).toBe(true)
    expect(productAgg.args.where.isHidden).toBe(false)
  })

  it('fixed number of queries and no writes', async () => {
    const { client, calls } = makeClient({})
    await loadSellerTrustProfile(client, { storeId: 'store-1', now: new Date() })
    const writes = calls.filter((c) => /create|update|delete|upsert/.test(c.method))
    expect(writes.length).toBe(0)
    // store, completed window, completed lifetime, cancelled, delivery, returns, firstSale, productAgg, vendorAgg = 9
    expect(calls.length).toBe(9)
  })
})
