import { describe, it, expect } from 'vitest'
import { formatRate, formatDelivery, formatReturns, formatRating } from './copy'
import { computeRate, computeDeliverySignal, computeReturnSignal, computeRatingSignal } from './metrics'

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
    const s = computeDeliverySignal([1, 2], 10)
    expect(formatDelivery(s)).toBe('Not enough deliveries yet')
  })
  it('delivery ok', () => {
    const s = computeDeliverySignal(Array(10).fill(2), 10)
    expect(formatDelivery(s)).toContain('2.0 days')
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
