import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCachedSellerTrustProfile } from './cached-profile'

vi.mock('next/cache', () => {
  const store = new Map<string, any>()
  return {
    unstable_cache: (cb: (...args: any[]) => Promise<any>, keyParts?: string[], _options?: any) => {
      return async (...args: any[]) => {
        const key = JSON.stringify({ keyParts, args })
        if (store.has(key)) return store.get(key)
        const value = await cb(...args)
        store.set(key, value)
        return value
      }
    },
  }
})

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(() => ({}) as any),
}))

vi.mock('@/lib/trust/load-profile', () => ({
  loadSellerTrustProfile: vi.fn(),
}))

import { loadSellerTrustProfile } from '@/lib/trust/load-profile'

describe('getCachedSellerTrustProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('caches a found profile so the loader runs once', async () => {
    const data = {
      verificationStatus: 'VERIFIED' as const,
      storeCreatedAt: new Date('2024-01-01T00:00:00Z'),
      firstSaleAt: new Date('2024-02-02T00:00:00Z'),
      verifiedSince: new Date('2024-03-03T00:00:00Z'),
      now: new Date('2025-01-01T00:00:00Z'),
      windowDays: 90,
      completedInWindow: 5,
      completedLifetime: 7,
      vendorCancelledInWindow: 1,
      deliveryDays: [1.5],
      sellerFaultReturnsInWindow: 0,
      reviewCount: 3,
      reviewSum: 12,
    }
    vi.mocked(loadSellerTrustProfile).mockResolvedValue({ found: true, data } as any)
    const first = await getCachedSellerTrustProfile('store-1')
    const second = await getCachedSellerTrustProfile('store-1')
    expect(loadSellerTrustProfile).toHaveBeenCalledTimes(1)
    expect(first.found).toBe(true)
    expect(second.found).toBe(true)
    if (first.found && second.found) {
      expect(first.data.storeCreatedAt).toBe('2024-01-01T00:00:00.000Z')
      expect(second.data.storeCreatedAt).toBe('2024-01-01T00:00:00.000Z')
    }
  })

  it('does not cache a not-found result', async () => {
    vi.mocked(loadSellerTrustProfile).mockResolvedValue({ found: false } as any)
    await getCachedSellerTrustProfile('missing')
    await getCachedSellerTrustProfile('missing')
    expect(loadSellerTrustProfile).toHaveBeenCalledTimes(2)
  })

  it('does not cache an error result', async () => {
    vi.mocked(loadSellerTrustProfile).mockRejectedValue(new Error('boom'))
    await expect(getCachedSellerTrustProfile('store-err')).rejects.toThrow('boom')
    await expect(getCachedSellerTrustProfile('store-err')).rejects.toThrow('boom')
    expect(loadSellerTrustProfile).toHaveBeenCalledTimes(2)
  })

  it('uses a different cache key per store', async () => {
    const data = {
      verificationStatus: 'UNVERIFIED' as const,
      storeCreatedAt: new Date('2024-01-01T00:00:00Z'),
      firstSaleAt: null,
      verifiedSince: null,
      now: new Date('2025-01-01T00:00:00Z'),
      windowDays: 90,
      completedInWindow: 0,
      completedLifetime: 0,
      vendorCancelledInWindow: 0,
      deliveryDays: [],
      sellerFaultReturnsInWindow: 0,
      reviewCount: 0,
      reviewSum: 0,
    }
    vi.mocked(loadSellerTrustProfile).mockResolvedValue({ found: true, data } as any)
    await getCachedSellerTrustProfile('store-a')
    await getCachedSellerTrustProfile('store-b')
    expect(loadSellerTrustProfile).toHaveBeenCalledTimes(2)
  })

  it('returns no customer or order identifiers', async () => {
    const data = {
      verificationStatus: 'UNVERIFIED' as const,
      storeCreatedAt: new Date('2024-01-01T00:00:00Z'),
      firstSaleAt: null,
      verifiedSince: null,
      now: new Date('2025-01-01T00:00:00Z'),
      windowDays: 90,
      completedInWindow: 0,
      completedLifetime: 0,
      vendorCancelledInWindow: 0,
      deliveryDays: [],
      sellerFaultReturnsInWindow: 0,
      reviewCount: 0,
      reviewSum: 0,
    }
    vi.mocked(loadSellerTrustProfile).mockResolvedValue({ found: true, data } as any)
    const res = await getCachedSellerTrustProfile('store-1')
    const text = JSON.stringify(res)
    expect(text).not.toMatch(/email|phone|address|firstName|lastName|orderId|customerId/i)
  })
})
