import { describe, it, expect } from 'vitest'
import { rehydrateProfileInput } from './rehydrate'
import type { CachedSellerTrustProfileData } from './cached-profile'

function cachedData(overrides: Partial<CachedSellerTrustProfileData> = {}): CachedSellerTrustProfileData {
  return {
    verificationStatus: 'VERIFIED',
    storeCreatedAt: '2024-01-01T00:00:00.000Z',
    firstSaleAt: '2024-02-02T00:00:00.000Z',
    verifiedSince: '2024-03-03T00:00:00.000Z',
    now: '2025-01-01T00:00:00.000Z',
    windowDays: 90,
    completedInWindow: 5,
    completedLifetime: 7,
    vendorCancelledInWindow: 1,
    deliveries: [{ deliveredAt: '2025-01-03T00:00:00.000Z', expectedAt: null, orderDate: '2025-01-01T00:00:00.000Z' }],
    responseSamples: [{ orderDate: '2025-01-01T00:00:00.000Z', firstVendorReplyAt: '2025-01-01T12:00:00.000Z' }],
    deliveryPolicyDays: 3,
    sellerFaultReturnsInWindow: 0,
    reviewCount: 3,
    reviewSum: 12,
    ...overrides,
  }
}

describe('rehydrateProfileInput', () => {
  it('rehydrates ISO strings into Date objects', () => {
    const input = rehydrateProfileInput(cachedData())
    expect(input.storeCreatedAt).toEqual(new Date('2024-01-01T00:00:00.000Z'))
    expect(input.firstSaleAt).toEqual(new Date('2024-02-02T00:00:00.000Z'))
    expect(input.verifiedSince).toEqual(new Date('2024-03-03T00:00:00.000Z'))
    expect(input.now).toEqual(new Date('2025-01-01T00:00:00.000Z'))
    expect(input.deliveries[0].deliveredAt).toEqual(new Date('2025-01-03T00:00:00.000Z'))
    expect(input.deliveries[0].expectedAt).toBeNull()
    expect(input.deliveries[0].orderDate).toEqual(new Date('2025-01-01T00:00:00.000Z'))
    expect(input.responseSamples[0].orderDate).toEqual(new Date('2025-01-01T00:00:00.000Z'))
    expect(input.responseSamples[0].firstVendorReplyAt).toEqual(new Date('2025-01-01T12:00:00.000Z'))
    expect(input.reviewCount).toBe(3)
    expect(input.reviewSum).toBe(12)
  })

  it('keeps null optional dates null', () => {
    const input = rehydrateProfileInput(cachedData({ firstSaleAt: null, verifiedSince: null, deliveries: [], responseSamples: [] }))
    expect(input.firstSaleAt).toBeNull()
    expect(input.verifiedSince).toBeNull()
    expect(input.deliveries).toEqual([])
    expect(input.responseSamples).toEqual([])
  })

  it('passes scalar trust fields through unchanged', () => {
    const input = rehydrateProfileInput(cachedData())
    expect(input.verificationStatus).toBe('VERIFIED')
    expect(input.windowDays).toBe(90)
    expect(input.completedInWindow).toBe(5)
    expect(input.completedLifetime).toBe(7)
    expect(input.vendorCancelledInWindow).toBe(1)
    expect(input.deliveryPolicyDays).toBe(3)
    expect(input.sellerFaultReturnsInWindow).toBe(0)
  })
})
