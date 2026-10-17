import { describe, it, expect } from 'vitest'
import { ONLINE_SALE_ORDER_FILTER, isManualOrder } from './order-source'

describe('isManualOrder', () => {
  it('returns true for source MANUAL', () => {
    expect(isManualOrder({ source: 'MANUAL' })).toBe(true)
  })

  it('returns false for source ONLINE', () => {
    expect(isManualOrder({ source: 'ONLINE' })).toBe(false)
  })

  it('returns false when source is null', () => {
    expect(isManualOrder({ source: null })).toBe(false)
  })

  it('returns false when source is undefined', () => {
    expect(isManualOrder({})).toBe(false)
  })
})

describe('ONLINE_SALE_ORDER_FILTER', () => {
  it('restricts to PAID and source ONLINE', () => {
    expect(ONLINE_SALE_ORDER_FILTER.paymentStatus).toEqual({ in: ['PAID'] })
    expect(ONLINE_SALE_ORDER_FILTER.source).toBe('ONLINE')
  })

  it('excludes cancelled orders', () => {
    expect(ONLINE_SALE_ORDER_FILTER.status).toEqual({ notIn: ['CANCELLED'] })
  })

  it('is a superset constraint of SALE_ORDER_FILTER plus source ONLINE', () => {
    expect(Object.keys(ONLINE_SALE_ORDER_FILTER)).toContain('source')
    expect(ONLINE_SALE_ORDER_FILTER.paymentStatus).toEqual({ in: ['PAID'] })
  })
})
