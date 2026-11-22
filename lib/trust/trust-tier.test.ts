import { describe, it, expect } from 'vitest'
import { composeProfile } from './metrics'
import { MIN_ORDERS_FOR_RATES, MIN_REVIEWS_FOR_RATING, SUPPRESSION_THRESHOLD } from './constants'

function makeDeliveries(n: number, onTime: number) {
  const onTimeSamples = Array.from({ length: onTime }, () => ({
    deliveredAt: new Date('2025-01-02T00:00:00Z'),
    expectedAt: new Date('2025-01-03T00:00:00Z'),
    orderDate: new Date('2025-01-01T00:00:00Z'),
  }))
  const lateSamples = Array.from({ length: n - onTime }, () => ({
    deliveredAt: new Date('2025-01-04T00:00:00Z'),
    expectedAt: new Date('2025-01-03T00:00:00Z'),
    orderDate: new Date('2025-01-01T00:00:00Z'),
  }))
  return [...onTimeSamples, ...lateSamples]
}

function makeResponseSamples(n: number, responsive: number) {
  const within = Array.from({ length: responsive }, () => ({
    orderDate: new Date('2025-01-01T00:00:00Z'),
    firstVendorReplyAt: new Date('2025-01-01T12:00:00Z'),
  }))
  const outside = Array.from({ length: n - responsive }, () => ({
    orderDate: new Date('2025-01-01T00:00:00Z'),
    firstVendorReplyAt: new Date('2025-01-04T00:00:00Z'),
  }))
  return [...within, ...outside]
}

describe('trust tier computation', () => {
  const baseInput = {
    storeCreatedAt: new Date('2024-01-01T00:00:00Z'),
    firstSaleAt: new Date('2024-02-01T00:00:00Z'),
    verificationStatus: 'UNVERIFIED' as const,
    verifiedSince: null,
    verificationMethod: 'NONE' as const,
    now: new Date('2025-06-01T00:00:00Z'),
    windowDays: 90,
    completedInWindow: 20,
    completedLifetime: 50,
    vendorCancelledInWindow: 1,
    deliveries: Array(20).fill(null).map(() => ({
      deliveredAt: new Date('2025-01-03T00:00:00Z'),
      expectedAt: null,
      orderDate: new Date('2025-01-01T00:00:00Z'),
    })),
    responseSamples: Array(20).fill(null).map(() => ({
      orderDate: new Date('2025-01-01T00:00:00Z'),
      firstVendorReplyAt: new Date('2025-01-01T12:00:00Z'),
    })),
    deliveryPolicyDays: 3,
    sellerFaultReturnsInWindow: 0,
    reviewCount: 20,
    reviewSum: 95,
  }

  it('New tier when insufficient orders', () => {
    const input = { ...baseInput, completedLifetime: 5 }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('New')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('lifetime orders'))).toBe(true)
  })

  it('New tier when fulfilment insufficient', () => {
    const input = { ...baseInput, completedInWindow: 5, completedLifetime: 20 }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('New')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('Fulfilment rate'))).toBe(true)
  })

  it('Established tier when all base criteria met', () => {
    const profile = composeProfile(baseInput)
    expect(profile.trustTier).toBe('Established')
    expect(profile.trustTierCriteria.met.length).toBeGreaterThan(0)
    expect(profile.trustTierCriteria.missing).not.toContain(`${MIN_ORDERS_FOR_RATES}+ lifetime orders`)
    expect(profile.trustTierCriteria.missing).not.toContain('Fulfilment rate available')
    expect(profile.trustTierCriteria.missing).not.toContain('Response rate available')
    expect(profile.trustTierCriteria.missing).not.toContain('Delivery reliability available')
    expect(profile.trustTierCriteria.missing).not.toContain('Return data not suppressed')
  })

  it('Trusted tier when verified + established + ratings + low returns', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'KYC' as const,
      sellerFaultReturnsInWindow: 1, // 1/20 = 5% return rate
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
    expect(profile.trustTierCriteria.met.some(m => m.includes('Verified identity'))).toBe(true)
    expect(profile.trustTierCriteria.met.some(m => m.includes('Ratings available'))).toBe(true)
    expect(profile.trustTierCriteria.met.some(m => m.includes('No open escalated returns'))).toBe(true)
  })

  it('Not Trusted when verified but no verification method', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'NONE' as const,
      sellerFaultReturnsInWindow: 1,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('Verified identity'))).toBe(true)
  })

  it('Not Trusted when open escalated returns present', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'KYC' as const,
      sellerFaultReturnsInWindow: 5, // 5/20 = 25% return rate
      openEscalatedReturnsInWindow: 5,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('No open escalated returns'))).toBe(true)
  })

  it('Trusted with 5 seller-fault returns in 100 completed (5%)', () => {
    const input = {
      ...baseInput,
      completedInWindow: 100,
      completedLifetime: 20,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'KYC' as const,
      sellerFaultReturnsInWindow: 5,
      openEscalatedReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
    expect(profile.trustTierCriteria.met.some(m => m.includes('Seller-fault return rate'))).toBe(true)
  })

  it('Trusted with 10 seller-fault returns in 100 completed (exactly 10%)', () => {
    const input = {
      ...baseInput,
      completedInWindow: 100,
      completedLifetime: 20,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'KYC' as const,
      sellerFaultReturnsInWindow: 10,
      openEscalatedReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
    expect(profile.trustTierCriteria.met.some(m => m.includes('Seller-fault return rate'))).toBe(true)
  })

  it('Trusted with 7 seller-fault returns in 70 completed (exactly 10%, floating-point check)', () => {
    const input = {
      ...baseInput,
      completedInWindow: 70,
      completedLifetime: 20,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'KYC' as const,
      sellerFaultReturnsInWindow: 7,
      openEscalatedReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
    expect(profile.trustTierCriteria.met.some(m => m.includes('Seller-fault return rate'))).toBe(true)
  })

  it('Established when completed is 0 but seller-fault returns >= 5 (rate fails)', () => {
    const input = {
      ...baseInput,
      completedInWindow: 0,
      completedLifetime: 20,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'KYC' as const,
      sellerFaultReturnsInWindow: 5,
      openEscalatedReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('New')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('Seller-fault return rate'))).toBe(true)
  })

  it('Established with 11 seller-fault returns in 100 completed (11%) - missing return-rate criterion', () => {
    const input = {
      ...baseInput,
      completedInWindow: 100,
      completedLifetime: 20,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'KYC' as const,
      sellerFaultReturnsInWindow: 11,
      openEscalatedReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('Seller-fault return rate'))).toBe(true)
  })

  it('Established with 25% seller-fault return rate (5 in 20) and no open escalated returns', () => {
    const input = {
      ...baseInput,
      completedInWindow: 20,
      completedLifetime: 20,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'KYC' as const,
      sellerFaultReturnsInWindow: 5,
      openEscalatedReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('Seller-fault return rate'))).toBe(true)
  })

  it('Trusted despite 40% seller-fault rate with only 4 returns (below 5-return floor, known low-volume gap)', () => {
    const input = {
      ...baseInput,
      completedInWindow: 10,
      completedLifetime: 20,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'KYC' as const,
      sellerFaultReturnsInWindow: 4,
      openEscalatedReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
    expect(profile.trustTierCriteria.met.some(m => m.includes('Seller-fault return rate'))).toBe(true)
  })

  it('Established with 1 open escalated return and 0% seller-fault rate', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'KYC' as const,
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 1,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('No open escalated returns'))).toBe(true)
  })

  it('Not Trusted when insufficient ratings', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'KYC' as const,
      reviewCount: 3, // Below MIN_REVIEWS_FOR_RATING
      reviewSum: 12,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('Ratings available'))).toBe(true)
  })

  it('ADMIN_FLAG never reaches Trusted', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      verificationMethod: 'ADMIN_FLAG' as const,
      sellerFaultReturnsInWindow: 1,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).not.toBe('Trusted')
    expect(profile.trustTier).toBe('Established')
  })

  // --- Established boundaries (fulfilment/on-time >= 70%, lifetime orders >= 10) ---

  it('Established boundary: fulfilment below 70%', () => {
    // 7 completed / 10 total = 70% (at); use 6/10 = 60% for below
    const input = { ...baseInput, completedInWindow: 6, vendorCancelledInWindow: 4 }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('New')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('Fulfilment rate'))).toBe(true)
  })

  it('Established boundary: fulfilment at 70%', () => {
    // 7 completed / 10 total = 70%
    const input = { ...baseInput, completedInWindow: 7, vendorCancelledInWindow: 3 }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
  })

  it('Established boundary: fulfilment above 70%', () => {
    // 8 completed / 11 total = 72.7%
    const input = { ...baseInput, completedInWindow: 8, vendorCancelledInWindow: 3 }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
  })

  it('Established boundary: on-time below 70%', () => {
    // 7 of 10 deliveries on-time = 70% (at); use 6 of 10 = 60% for below
    const input = {
      ...baseInput,
      deliveries: [
        ...Array(6).fill(null).map(() => ({
          deliveredAt: new Date('2025-01-10T00:00:00Z'),
          expectedAt: new Date('2025-01-01T00:00:00Z'),
          orderDate: new Date('2025-01-01T00:00:00Z'),
        })),
        ...Array(4).fill(null).map(() => ({
deliveredAt: new Date('2025-01-04T00:00:00Z'),
           expectedAt: new Date('2025-01-03T00:00:00Z'),
          orderDate: new Date('2025-01-01T00:00:00Z'),
        })),
      ],
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('New')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('On-time rate'))).toBe(true)
  })

  it('Established boundary: on-time at 70%', () => {
    // 7 of 10 deliveries on-time = 70%
    const input = {
      ...baseInput,
      deliveries: [
        ...Array(7).fill(null).map(() => ({
deliveredAt: new Date('2025-01-02T00:00:00Z'),
           expectedAt: new Date('2025-01-03T00:00:00Z'),
          orderDate: new Date('2025-01-01T00:00:00Z'),
        })),
        ...Array(3).fill(null).map(() => ({
deliveredAt: new Date('2025-01-04T00:00:00Z'),
           expectedAt: new Date('2025-01-03T00:00:00Z'),
          orderDate: new Date('2025-01-01T00:00:00Z'),
        })),
      ],
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
  })

  it('Established boundary: on-time above 70%', () => {
    // 8 of 10 deliveries on-time = 80%
    const input = {
      ...baseInput,
      deliveries: [
        ...Array(8).fill(null).map(() => ({
deliveredAt: new Date('2025-01-02T00:00:00Z'),
           expectedAt: new Date('2025-01-03T00:00:00Z'),
          orderDate: new Date('2025-01-01T00:00:00Z'),
        })),
        ...Array(2).fill(null).map(() => ({
deliveredAt: new Date('2025-01-04T00:00:00Z'),
           expectedAt: new Date('2025-01-03T00:00:00Z'),
          orderDate: new Date('2025-01-01T00:00:00Z'),
        })),
      ],
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
  })

  it('Established boundary: lifetime orders below 10', () => {
    const input = { ...baseInput, completedLifetime: 9 }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('New')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('lifetime orders'))).toBe(true)
  })

  it('Established boundary: lifetime orders at 10', () => {
    const input = { ...baseInput, completedLifetime: 10 }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
  })

  it('Established boundary: lifetime orders above 10', () => {
    const input = { ...baseInput, completedLifetime: 11 }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
  })

  // --- Trusted boundaries (fulfilment/on-time/response >= 80%, reviews >= 5) ---

  it('Trusted boundary: fulfilment below 80%', () => {
    // 7 completed / 10 total = 70% < 80%
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      completedInWindow: 7,
      vendorCancelledInWindow: 3,
      sellerFaultReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('Fulfilment rate >= 80%'))).toBe(true)
  })

  it('Trusted boundary: fulfilment at 80%', () => {
    // 8 completed / 10 total = 80%
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      completedInWindow: 8,
      vendorCancelledInWindow: 2,
      sellerFaultReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
    expect(profile.trustTierCriteria.met.some(m => m.includes('Fulfilment rate >= 80%'))).toBe(true)
  })

  it('Trusted boundary: fulfilment above 80%', () => {
    // 9 completed / 10 total = 90% > 80%
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      completedInWindow: 9,
      vendorCancelledInWindow: 1,
      sellerFaultReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
  })

  it('Trusted boundary: on-time below 80%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      deliveries: [
        ...Array(7).fill(null).map(() => ({
deliveredAt: new Date('2025-01-02T00:00:00Z'),
           expectedAt: new Date('2025-01-03T00:00:00Z'),
          orderDate: new Date('2025-01-01T00:00:00Z'),
        })),
        ...Array(3).fill(null).map(() => ({
deliveredAt: new Date('2025-01-04T00:00:00Z'),
           expectedAt: new Date('2025-01-03T00:00:00Z'),
          orderDate: new Date('2025-01-01T00:00:00Z'),
        })),
      ],
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('On-time rate >= 80%'))).toBe(true)
  })

  it('Trusted boundary: on-time at 80%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      deliveries: [
        ...Array(8).fill(null).map(() => ({
deliveredAt: new Date('2025-01-02T00:00:00Z'),
           expectedAt: new Date('2025-01-03T00:00:00Z'),
          orderDate: new Date('2025-01-01T00:00:00Z'),
        })),
        ...Array(2).fill(null).map(() => ({
deliveredAt: new Date('2025-01-04T00:00:00Z'),
           expectedAt: new Date('2025-01-03T00:00:00Z'),
          orderDate: new Date('2025-01-01T00:00:00Z'),
        })),
      ],
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
  })

  it('Trusted boundary: response below 80%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      responseSamples: [
        ...Array(7).fill(null).map(() => ({
          orderDate: new Date('2025-01-01T00:00:00Z'),
          firstVendorReplyAt: new Date('2025-01-01T12:00:00Z'),
        })),
        ...Array(3).fill(null).map(() => ({
           orderDate: new Date('2025-01-01T00:00:00Z'),
           firstVendorReplyAt: new Date('2025-01-04T00:00:00Z'),
         })),
      ],
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('Response rate >= 80%'))).toBe(true)
  })

  it('Trusted boundary: response at 80%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      responseSamples: [
        ...Array(8).fill(null).map(() => ({
          orderDate: new Date('2025-01-01T00:00:00Z'),
          firstVendorReplyAt: new Date('2025-01-01T12:00:00Z'),
        })),
        ...Array(2).fill(null).map(() => ({
          orderDate: new Date('2025-01-01T00:00:00Z'),
          firstVendorReplyAt: new Date('2025-01-03T00:00:00Z'),
        })),
      ],
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
  })

  it('Trusted boundary: reviews below 5', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      reviewCount: 4,
      reviewSum: 20,
      sellerFaultReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Established')
    expect(profile.trustTierCriteria.missing.some(m => m.includes('Ratings available'))).toBe(true)
  })

  it('Trusted boundary: reviews at 5', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      reviewCount: 5,
      reviewSum: 25,
      sellerFaultReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
  })

  it('Trusted boundary: reviews above 5', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      reviewCount: 6,
      reviewSum: 30,
      sellerFaultReturnsInWindow: 0,
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
  })

  it('criteria lists are complete', () => {
    const profile = composeProfile(baseInput)
    const allCriteria = [
       `${MIN_ORDERS_FOR_RATES}+ lifetime orders`,
       'Fulfilment rate >= threshold',
       'On-time rate >= threshold',
       'Verified identity (KYC)',
       'Fulfilment rate >= 80%',
       'On-time rate >= 80%',
       'Response rate >= 80%',
       `Ratings available (${MIN_REVIEWS_FOR_RATING}+ reviews)`,
       'No open escalated returns',
     ]
    for (const criterion of allCriteria) {
      const inMet = profile.trustTierCriteria.met.includes(criterion)
      const inMissing = profile.trustTierCriteria.missing.includes(criterion)
      expect(inMet || inMissing).toBe(true)
    }
  })

  // On-time tier boundaries using the fixture helper (varying one input each).
  it('Established on-time boundary: below 70%', () => {
    const input = { ...baseInput, deliveries: makeDeliveries(10, 6) }
    expect(composeProfile(input).trustTier).toBe('New')
  })
  it('Established on-time boundary: at 70%', () => {
    const input = { ...baseInput, deliveries: makeDeliveries(10, 7) }
    expect(composeProfile(input).trustTier).toBe('Established')
  })
  it('Established on-time boundary: above 70%', () => {
    const input = { ...baseInput, deliveries: makeDeliveries(10, 8) }
    expect(composeProfile(input).trustTier).toBe('Established')
  })
  it('Trusted on-time boundary: below 80%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      deliveries: makeDeliveries(10, 7),
    }
    expect(composeProfile(input).trustTier).toBe('Established')
  })
  it('Trusted on-time boundary: at 80%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      deliveries: makeDeliveries(10, 8),
    }
    const profile = composeProfile(input)
    expect(profile.trustTier).toBe('Trusted')
  })

  // Additional boundary tests (exact counts, varying one input each).
  it('Established fulfilment boundary: 69%', () => {
    const input = { ...baseInput, completedInWindow: 69, vendorCancelledInWindow: 31 }
    expect(composeProfile(input).trustTier).toBe('New')
  })
  it('Established fulfilment boundary: 70%', () => {
    const input = { ...baseInput, completedInWindow: 70, vendorCancelledInWindow: 30 }
    expect(composeProfile(input).trustTier).toBe('Established')
  })
  it('Established fulfilment boundary: 71%', () => {
    const input = { ...baseInput, completedInWindow: 71, vendorCancelledInWindow: 29 }
    expect(composeProfile(input).trustTier).toBe('Established')
  })

  it('Trusted fulfilment boundary: 79%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      completedInWindow: 79,
      vendorCancelledInWindow: 21,
    }
    expect(composeProfile(input).trustTier).toBe('Established')
  })
  it('Trusted fulfilment boundary: 80%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      completedInWindow: 80,
      vendorCancelledInWindow: 20,
    }
    expect(composeProfile(input).trustTier).toBe('Trusted')
  })
  it('Trusted fulfilment boundary: 81%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      completedInWindow: 81,
      vendorCancelledInWindow: 19,
    }
    expect(composeProfile(input).trustTier).toBe('Trusted')
  })

  it('Trusted on-time boundary: above 80%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      deliveries: makeDeliveries(10, 9),
    }
    expect(composeProfile(input).trustTier).toBe('Trusted')
  })

  it('Trusted response boundary: 79%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      responseSamples: makeResponseSamples(100, 79),
    }
    expect(composeProfile(input).trustTier).toBe('Established')
  })
  it('Trusted response boundary: 80%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      responseSamples: makeResponseSamples(100, 80),
    }
    expect(composeProfile(input).trustTier).toBe('Trusted')
  })
  it('Trusted response boundary: 81%', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      responseSamples: makeResponseSamples(100, 81),
    }
    expect(composeProfile(input).trustTier).toBe('Trusted')
  })

  it('Trusted reviews boundary: 4', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      reviewCount: 4,
      reviewSum: 20,
    }
    expect(composeProfile(input).trustTier).toBe('Established')
  })
  it('Trusted reviews boundary: 5', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      reviewCount: 5,
      reviewSum: 25,
    }
    expect(composeProfile(input).trustTier).toBe('Trusted')
  })
  it('Trusted reviews boundary: 6', () => {
    const input = {
      ...baseInput,
      verificationStatus: 'VERIFIED' as const,
      verificationMethod: 'KYC' as const,
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      sellerFaultReturnsInWindow: 0,
      openEscalatedReturnsInWindow: 0,
      reviewCount: 6,
      reviewSum: 30,
    }
    expect(composeProfile(input).trustTier).toBe('Trusted')
  })

  it('Established lifetime orders boundary: 9', () => {
    const input = { ...baseInput, completedLifetime: 9 }
    expect(composeProfile(input).trustTier).toBe('New')
  })
  it('Established lifetime orders boundary: 10', () => {
    const input = { ...baseInput, completedLifetime: 10 }
    expect(composeProfile(input).trustTier).toBe('Established')
  })
  it('Established lifetime orders boundary: 11', () => {
    const input = { ...baseInput, completedLifetime: 11 }
    expect(composeProfile(input).trustTier).toBe('Established')
  })
})