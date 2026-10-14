import { describe, it, expect } from 'vitest'
import {
  SALE_ORDER_FILTER,
  NOT_CANCELLED_STATUSES,
  isSaleOrder,
  isRefundedOrder,
  cancelledOrderLabel,
  withSaleFilter,
} from './order-sale-filter'

// Pure unit tests for the shared "sale" definition. No database, no mocks:
// every case below is a shape, so the rule itself is pinned.

describe('isSaleOrder', () => {
  it('counts a paid order that is still moving', () => {
    expect(isSaleOrder({ paymentStatus: 'PAID', status: 'PROCESSING' })).toBe(true)
    expect(isSaleOrder({ paymentStatus: 'PAID', status: 'SHIPPED' })).toBe(true)
    expect(isSaleOrder({ paymentStatus: 'PAID', status: 'DELIVERED' })).toBe(true)
    expect(isSaleOrder({ paymentStatus: 'PAID', status: 'COMPLETED' })).toBe(true)
    expect(isSaleOrder({ paymentStatus: 'PAID', status: 'PENDING' })).toBe(true)
  })

  it('excludes a cancelled paid order, which is the refund-in-progress state', () => {
    expect(isSaleOrder({ paymentStatus: 'PAID', status: 'CANCELLED' })).toBe(false)
  })

  it('excludes a refunded order', () => {
    expect(isSaleOrder({ paymentStatus: 'REFUNDED', status: 'COMPLETED' })).toBe(false)
    expect(isSaleOrder({ paymentStatus: 'REFUNDED', status: 'CANCELLED' })).toBe(false)
  })

  it('excludes anything that was never charged', () => {
    expect(isSaleOrder({ paymentStatus: 'PENDING', status: 'PROCESSING' })).toBe(false)
    expect(isSaleOrder({ paymentStatus: 'FAILED', status: 'PENDING' })).toBe(false)
    expect(isSaleOrder({ paymentStatus: 'CANCELLED', status: 'PENDING' })).toBe(false)
  })

  it('excludes a missing or unknown status rather than guessing', () => {
    expect(isSaleOrder({ paymentStatus: 'PAID' })).toBe(false)
    expect(isSaleOrder({ paymentStatus: 'PAID', status: null })).toBe(false)
    expect(isSaleOrder({ paymentStatus: 'PAID', status: 'SOMETHING_NEW' })).toBe(false)
  })
})

describe('SALE_ORDER_FILTER', () => {
  it('requires PAID and a status that is not CANCELLED', () => {
    expect(SALE_ORDER_FILTER.paymentStatus).toEqual({ in: ['PAID'] })
    expect(SALE_ORDER_FILTER.status).toEqual({ notIn: ['CANCELLED'] })
  })

  it('lists every non-cancelled order status', () => {
    expect([...NOT_CANCELLED_STATUSES].sort()).toEqual(
      ['COMPLETED', 'DELIVERED', 'PENDING', 'PROCESSING', 'SHIPPED']
    )
  })

  it('merges other conditions without losing them', () => {
    const where = withSaleFilter({ createdAt: { gte: new Date(0) }, deletedAt: null })
    expect(where).toEqual({
      createdAt: { gte: new Date(0) },
      deletedAt: null,
      paymentStatus: { in: ['PAID'] },
      status: { notIn: ['CANCELLED'] },
    })
  })
})

describe('cancelledOrderLabel', () => {
  it("reads 'Cancelled, refund pending review' while the refund request waits", () => {
    expect(cancelledOrderLabel({ paymentStatus: 'PAID', status: 'CANCELLED' })).toBe(
      'Cancelled, refund pending review'
    )
  })

  it("reads 'Refunded' only once the order is REFUNDED", () => {
    expect(cancelledOrderLabel({ paymentStatus: 'REFUNDED', status: 'CANCELLED' })).toBe('Refunded')
    expect(cancelledOrderLabel({ paymentStatus: 'REFUNDED', status: 'COMPLETED' })).toBe('Refunded')
  })

  it("reads 'Cancelled' for a plain unpaid cancellation", () => {
    expect(cancelledOrderLabel({ paymentStatus: 'PENDING', status: 'CANCELLED' })).toBe('Cancelled')
    expect(cancelledOrderLabel({ paymentStatus: 'CANCELLED', status: 'CANCELLED' })).toBe('Cancelled')
  })

  it('never reports a pending refund as Refunded', () => {
    const order = { paymentStatus: 'PAID' as const, status: 'CANCELLED' as const }
    expect(cancelledOrderLabel(order)).not.toBe('Refunded')
    expect(isRefundedOrder(order)).toBe(false)
  })
})
