import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { syncStoreRating } from '@/lib/rating-sync'

const mockGetPrisma = vi.mocked(getPrisma)

function buildMockPrisma() {
  const aggregate = vi.fn(async () => ({ _count: { _all: 3 }, _sum: { rating: 13 } }))
  const update = vi.fn(async () => ({}))
  const prisma: any = {
    vendorReview: { aggregate },
    store: { update },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  }
  return { prisma, aggregate, update }
}

describe('syncStoreRating concurrency', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['prisma']
  let aggregate: ReturnType<typeof buildMockPrisma>['aggregate']
  let update: ReturnType<typeof buildMockPrisma>['update']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockPrisma()
    mockPrisma = ctx.prisma
    aggregate = ctx.aggregate
    update = ctx.update
    mockGetPrisma.mockReturnValue(mockPrisma as any)
  })

  it('updates averageRating and reviewCount for a store', async () => {
    await syncStoreRating('store-1')

    expect(aggregate).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
    const calls = update.mock.calls as any[]
    expect(calls[0][0].where).toEqual({ id: 'store-1' })
    expect(calls[0][0].data).toEqual({ averageRating: 4.3, reviewCount: 3 })
  })

  it('handles concurrent syncStoreRating calls for the same store', async () => {
    await Promise.all([syncStoreRating('store-1'), syncStoreRating('store-1')])

    expect(aggregate).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenCalledTimes(2)
    const calls = update.mock.calls as any[]
    expect(calls[0][0].data).toEqual({ averageRating: 4.3, reviewCount: 3 })
    expect(calls[1][0].data).toEqual({ averageRating: 4.3, reviewCount: 3 })
  })

  it('resets the store rating when there are no approved reviews', async () => {
    aggregate.mockResolvedValueOnce({ _count: { _all: 0 }, _sum: { rating: null as any } })

    await syncStoreRating('store-1')

    const calls = update.mock.calls as any[]
    expect(calls[0][0].data).toEqual({ averageRating: 0, reviewCount: 0 })
  })
})
