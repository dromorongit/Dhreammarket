import { describe, it, expect } from 'vitest'
import { formatRate, formatDelivery, formatReturns, formatRating, formatResponseRate } from './copy'
import { computeRate, computeDeliverySignal, computeReturnSignal, computeRatingSignal, computeResponseRateSignal } from './metrics'
import { RESPONSE_WINDOW_DAYS } from './constants'

describe('copy helpers', () => {
  it('rate insufficient', () => {
    const s = computeRate(1, 5, 10)
    expect(formatRate(s, 'Orders fulfilled')).toBe('Not enough orders yet')
  })
  it('rate ok', () => {
    const s = computeRate(9, 10, 10)
    expect(formatRate(s, 'Orders fulfilled')).toContain('9 of 10')
  })
  it('delivery insufficient', () => {
    const s = computeDeliverySignal([], 10, 3)
    expect(formatDelivery(s)).toBe('Not enough deliveries yet')
  })
  it('delivery ok', () => {
    const s = computeDeliverySignal(Array(10).fill(null).map(() => ({
      deliveredAt: new Date('2025-01-03T00:00:00Z'),
      expectedAt: null,
      orderDate: new Date('2025-01-01T00:00:00Z'),
    })), 10, 3)
    expect(formatDelivery(s)).toContain('On-time delivery')
    expect(formatDelivery(s)).toContain('median 2.0 days')
  })
  it('response rate label includes the response window days', () => {
    const s = computeResponseRateSignal(Array(10).fill(null).map(() => ({
      orderDate: new Date('2025-01-01T00:00:00Z'),
      firstVendorReplyAt: new Date('2025-01-01T12:00:00Z'),
    })), 10, RESPONSE_WINDOW_DAYS)
    expect(formatResponseRate(s)).toContain(`within ${RESPONSE_WINDOW_DAYS} days`)
    expect(formatResponseRate(s)).toContain('10 of 10')
    expect(formatResponseRate(s)).toContain('100.0%')
  })
  it('returns suppressed', () => {
    const s = computeReturnSignal(3, 10, 10)
    expect(formatReturns(s)).toBe('Fewer than 5')
  })
  it('returns ok', () => {
    const s = computeReturnSignal(5, 10, 10)
    expect(formatReturns(s)).toContain('5 of 10')
  })
  it('rating insufficient', () => {
    const s = computeRatingSignal(2, 10, 5)
    expect(formatRating(s)).toBe('Not enough reviews yet')
  })
  it('rating ok', () => {
    const s = computeRatingSignal(5, 25, 5)
    expect(formatRating(s)).toContain('5.0 from 5 verified purchases')
  })
})
