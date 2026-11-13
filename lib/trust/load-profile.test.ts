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
      findMany: vi.fn(async (args: any) => {
        calls.push({ delegate: 'order', method: 'findMany', args })
        return overrides.paidOrders ?? []
      }),
    },
    orderItem: {
      findMany: vi.fn(async (args: any) => {
        calls.push({ delegate: 'orderItem', method: 'findMany', args })
        return overrides.deliveryItems ?? []
      }),
    },
    platformPolicy: {
      findUnique: vi.fn(async (args: any) => {
        calls.push({ delegate: 'platformPolicy', method: 'findUnique', args })
        return { dispatchTargetDaysAfterPayment: 3 }
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
    // store, completed window, completed lifetime, cancelled, delivery, policy, returns, firstSale, productAgg, vendorAgg, response orders = 11
    expect(calls.length).toBe(11)
  })

  it('response samples start at payment date and skip unpaid orders', async () => {
    const now = new Date('2025-01-10T00:00:00Z')
    const { client } = makeClient({
      paidOrders: [
        { id: 'o-1', paymentConfirmedAt: new Date('2025-01-01T00:00:00Z'), createdAt: new Date('2024-12-01T00:00:00Z'), orderMessages: [{ createdAt: new Date('2025-01-01T08:00:00Z') }] },
        { id: 'o-2', paymentConfirmedAt: null, createdAt: new Date('2024-12-01T00:00:00Z'), orderMessages: [{ createdAt: new Date('2025-01-02T00:00:00Z') }] },
      ],
    })
    const res = await loadSellerTrustProfile(client, { storeId: 'store-1', now })
    if (res.found) {
      expect(res.data.responseSamples).toEqual([
        { orderDate: new Date('2025-01-01T00:00:00Z'), firstVendorReplyAt: new Date('2025-01-01T08:00:00Z') },
      ])
    }
  })

  it('system messages are not treated as the first vendor reply', async () => {
    const now = new Date('2025-01-10T00:00:00Z')
    const { client } = makeClient({
      paidOrders: [
        {
          id: 'o-1',
          paymentConfirmedAt: new Date('2025-01-01T00:00:00Z'),
          createdAt: new Date('2024-12-01T00:00:00Z'),
          orderMessages: [
            { userRole: 'SYSTEM', createdAt: new Date('2025-01-01T01:00:00Z') },
            { userRole: 'VENDOR', createdAt: new Date('2025-01-01T09:00:00Z') },
          ],
        },
      ],
    })
    const res = await loadSellerTrustProfile(client, { storeId: 'store-1', now })
    if (res.found) {
      expect(res.data.responseSamples).toEqual([
        { orderDate: new Date('2025-01-01T00:00:00Z'), firstVendorReplyAt: new Date('2025-01-01T09:00:00Z') },
      ])
    }
  })

  it('delivery samples start at payment date and skip unpaid orders', async () => {
    const now = new Date('2025-01-10T00:00:00Z')
    const { client } = makeClient({
      deliveryItems: [
        { id: 'i-1', deliveredAt: new Date('2025-01-04T00:00:00Z'), expectedArrivalDate: null, order: { paymentConfirmedAt: new Date('2025-01-01T00:00:00Z'), createdAt: new Date('2024-12-01T00:00:00Z') } },
        { id: 'i-2', deliveredAt: new Date('2025-01-04T00:00:00Z'), expectedArrivalDate: null, order: { paymentConfirmedAt: null, createdAt: new Date('2024-12-01T00:00:00Z') } },
      ],
    })
    const res = await loadSellerTrustProfile(client, { storeId: 'store-1', now })
    if (res.found) {
      expect(res.data.deliveries).toEqual([
        { deliveredAt: new Date('2025-01-04T00:00:00Z'), expectedAt: null, orderDate: new Date('2025-01-01T00:00:00Z') },
      ])
    }
  })
})
