import { describe, it, expect } from 'vitest'
import {
  computeRate,
  computeFulfilmentSignal,
  computeCancellationSignal,
  computeDeliverySignal,
  computeReturnSignal,
  computeRatingSignal,
  computeTenure,
  composeProfile,
} from './metrics'
import { MIN_ORDERS_FOR_RATES, MIN_REVIEWS_FOR_RATING, SUPPRESSION_THRESHOLD } from './constants'

describe('computeRate', () => {
  it('zero denominator -> insufficient', () => {
    expect(computeRate(0, 0, 10).state).toBe('INSUFFICIENT_DATA')
    const r = computeRate(0, 0, 10)
    expect(Number.isNaN(r.counts.numerator)).toBe(false)
  })
  it('boundary 9/10/11', () => {
    expect(computeRate(5, 9, 10).state).toBe('INSUFFICIENT_DATA')
    expect(computeRate(5, 10, 10).state).toBe('OK')
    expect(computeRate(5, 11, 10).state).toBe('OK')
  })
  it('rounding', () => {
    expect(computeRate(1, 3, 1).value?.percentage).toBe(33.3)
    expect(computeRate(2, 3, 1).value?.percentage).toBe(66.7)
    expect(computeRate(199, 200, 1).value?.percentage).toBe(99.5)
  })
  it('no NaN/Infinity property', () => {
    let seed = 1
    const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
    for (let i = 0; i < 500; i++) {
      const den = Math.floor(rand() * 50)
      const num = Math.floor(rand() * (den + 1))
      const r = computeRate(num, den, 1)
      if (r.state === 'OK' && r.value) {
        expect(r.value.percentage).toBeGreaterThanOrEqual(0)
        expect(r.value.percentage).toBeLessThanOrEqual(100)
        expect(Number.isNaN(r.value.percentage)).toBe(false)
        expect(Number.isFinite(r.value.percentage)).toBe(true)
      }
    }
  })
})

describe('fulfilment/cancellation', () => {
  it('all fulfilled', () => {
    const f = computeFulfilmentSignal(10, 0, 10)
    expect(f.state).toBe('OK')
    expect(f.value?.percentage).toBe(100)
    const c = computeCancellationSignal(0, 10, 10)
    expect(c.value?.percentage).toBe(0)
  })
  it('all cancelled', () => {
    const f = computeFulfilmentSignal(0, 10, 10)
    expect(f.value?.percentage).toBe(0)
    const c = computeCancellationSignal(10, 0, 10)
    expect(c.value?.percentage).toBe(100)
  })
  it('in-progress excluded by caller; zero denom insufficient', () => {
    const f = computeFulfilmentSignal(0, 0, 10)
    expect(f.state).toBe('INSUFFICIENT_DATA')
  })
  it('vendor vs customer: only vendor count passed', () => {
    // customer cancellations not included in vendorCancelled param
    const c = computeCancellationSignal(2, 8, 10)
    expect(c.counts.denominator).toBe(10)
    expect(c.value?.percentage).toBe(20)
  })
})

describe('delivery', () => {
  it('median odd', () => {
    const d = computeDeliverySignal([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10)
    expect(d.state).toBe('OK')
    expect(d.value?.medianDays).toBe(5.5)
  })
  it('boundary', () => {
    expect(computeDeliverySignal(Array(9).fill(1), 10).state).toBe('INSUFFICIENT_DATA')
    expect(computeDeliverySignal(Array(10).fill(1), 10).state).toBe('OK')
    expect(computeDeliverySignal(Array(11).fill(1), 10).state).toBe('OK')
  })
  it('window boundaries one second either side handled by caller; median finite', () => {
    const d = computeDeliverySignal([0.5, 1.5], 1)
    expect(Number.isFinite(d.value?.medianDays ?? 0)).toBe(true)
  })
})

describe('returns suppression', () => {
  it('4,5,6 boundaries', () => {
    const r4 = computeReturnSignal(4, 10, 10)
    expect((r4 as any).state).toBe('SUPPRESSED')
    expect(JSON.stringify(r4)).not.toMatch(/4/)
    const r5 = computeReturnSignal(5, 10, 10)
    expect((r5 as any).state).toBe('OK')
    const r6 = computeReturnSignal(6, 10, 10)
    expect((r6 as any).state).toBe('OK')
  })
  it('suppressed band has no count/rate', () => {
    const r = computeReturnSignal(3, 10, 10) as any
    expect(r.counts).toBeUndefined()
    expect(r.value).toBeUndefined()
  })
  it('change-of-mind excluded by caller; denied excluded by caller', () => {
    // if only seller-fault count passed, rate uses it
    const r = computeReturnSignal(5, 10, 10) as any
    expect(r.value.percentage).toBe(50)
  })
})

describe('ratings', () => {
  it('4,5,6 boundaries', () => {
    expect(computeRatingSignal(4, 20, 5).state).toBe('INSUFFICIENT_DATA')
    expect(computeRatingSignal(5, 25, 5).state).toBe('OK')
    expect(computeRatingSignal(6, 30, 5).state).toBe('OK')
  })
  it('average rounding', () => {
    const r = computeRatingSignal(5, 23, 5)
    expect(r.value?.average).toBe(4.6)
  })
})

describe('tenure', () => {
  it('days', () => {
    const now = new Date('2025-01-11T00:00:00Z')
    const created = new Date('2025-01-01T00:00:00Z')
    expect(computeTenure(created, null, now).daysOnPlatform).toBe(10)
  })
})

describe('composeProfile', () => {
  it('no clock read: computedAt equals now param', () => {
    const now = new Date('2025-06-01T00:00:00Z')
    const p = composeProfile({
      storeCreatedAt: new Date('2024-01-01T00:00:00Z'),
      firstSaleAt: new Date('2024-02-01T00:00:00Z'),
      verificationStatus: 'VERIFIED',
      verifiedSince: new Date('2024-03-01T00:00:00Z'),
      now,
      windowDays: 90,
      completedInWindow: 10,
      completedLifetime: 20,
      vendorCancelledInWindow: 1,
      deliveryDays: Array(10).fill(2),
      sellerFaultReturnsInWindow: 0,
      reviewCount: 5,
      reviewSum: 25,
    })
    expect(p.computedAt).toBe(now)
    expect(p.identity.status).toBe('VERIFIED')
    expect(p.orders.completed).toBe(10)
    expect(p.orders.lifetimeCompleted).toBe(20)
  })
  it('not available state for missing data', () => {
    const now = new Date('2025-06-01T00:00:00Z')
    const p = composeProfile({
      storeCreatedAt: new Date('2025-05-01T00:00:00Z'),
      now,
      windowDays: 90,
      completedInWindow: 0,
      completedLifetime: 0,
      vendorCancelledInWindow: 0,
      deliveryDays: [],
      sellerFaultReturnsInWindow: 0,
      reviewCount: 0,
      reviewSum: 0,
      verificationStatus: 'UNVERIFIED',
    })
    expect(p.ratings.state).toBe('INSUFFICIENT_DATA') 
  })
})
