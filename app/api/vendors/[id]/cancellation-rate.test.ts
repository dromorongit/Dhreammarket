import { describe, it, expect } from 'vitest'
import { countAttributableVendorCancelledOrders } from '@/lib/trust-metrics'
import { SALE_ORDER_FILTER, isSaleOrder, cancelledOrderLabel } from '@/lib/order-sale-filter'

// Regression tests for the two rules this stage changed:
//
//  1. A rejected order counts EXACTLY ONCE in the store's cancellation rate,
//     whether its refund is still pending (PAID) or already settled (REFUNDED).
//  2. A rejected order is NEVER counted as revenue: the shared sale filter
//     excludes it in both payment states.
//
// Every fixture below is a plain object. No database and no mocks of Paystack
// are involved.

const PRODUCTS = [
  { id: 'product-1', storeId: 'store-1' },
  { id: 'product-2', storeId: 'store-2' },
]

const SINGLE_ITEM = [{ orderId: 'order-1', productId: 'product-1' }]
const MULTI_ITEMS = [
  { orderId: 'order-1', productId: 'product-1' },
  { orderId: 'order-1', productId: 'product-2' },
]

function rejectedOrder(paymentStatus: string) {
  return { id: 'order-1', paymentStatus, vendorRejected: true }
}

describe('vendor cancellation count', () => {
  it('counts a rejected order whose refund is still pending', () => {
    expect(
      countAttributableVendorCancelledOrders(
        [rejectedOrder('PAID')],
        SINGLE_ITEM,
        PRODUCTS,
        'store-1'
      )
    ).toBe(1)
  })

  it('counts a rejected order whose refund has already been settled', () => {
    // Before this change a settled refund moved the order to REFUNDED, which
    // dropped it out of the count entirely, so the rate read zero.
    expect(
      countAttributableVendorCancelledOrders(
        [rejectedOrder('REFUNDED')],
        SINGLE_ITEM,
        PRODUCTS,
        'store-1'
      )
    ).toBe(1)
  })

  it('counts one rejected order exactly once, not once per payment state', () => {
    // The same order appearing in both states must not be double counted: the
    // function keys off the order id, so a single id can only be attributed
    // once even if it is listed twice.
    expect(
      countAttributableVendorCancelledOrders(
        [rejectedOrder('PAID'), rejectedOrder('REFUNDED')],
        SINGLE_ITEM,
        PRODUCTS,
        'store-1'
      )
    ).toBe(1)
  })

  it('does not count a rejected order for another store', () => {
    expect(
      countAttributableVendorCancelledOrders(
        [rejectedOrder('PAID'), rejectedOrder('REFUNDED')],
        SINGLE_ITEM,
        PRODUCTS,
        'store-2'
      )
    ).toBe(0)
  })

  it('does not count a multi-store rejected order for either store', () => {
    const orders = [rejectedOrder('PAID'), rejectedOrder('REFUNDED')]
    expect(
      countAttributableVendorCancelledOrders(orders, MULTI_ITEMS, PRODUCTS, 'store-1')
    ).toBe(0)
    expect(
      countAttributableVendorCancelledOrders(orders, MULTI_ITEMS, PRODUCTS, 'store-2')
    ).toBe(0)
  })

  it('does not count an order that was never rejected', () => {
    const orders = [
      { id: 'order-1', paymentStatus: 'PAID', vendorRejected: false },
      { id: 'order-1', paymentStatus: 'REFUNDED', vendorRejected: false },
    ]
    expect(
      countAttributableVendorCancelledOrders(orders, SINGLE_ITEM, PRODUCTS, 'store-1')
    ).toBe(0)
  })

  it('does not count a rejected order in a payment state outside the rule', () => {
    const orders = [
      { id: 'order-1', paymentStatus: 'PENDING', vendorRejected: true },
      { id: 'order-1', paymentStatus: 'FAILED', vendorRejected: true },
      { id: 'order-1', paymentStatus: 'CANCELLED', vendorRejected: true },
    ]
    expect(
      countAttributableVendorCancelledOrders(orders, SINGLE_ITEM, PRODUCTS, 'store-1')
    ).toBe(0)
  })
})

describe('a rejected order is never revenue', () => {
  it('excludes a rejected order in both payment states from sales', () => {
    expect(isSaleOrder({ paymentStatus: 'PAID', status: 'CANCELLED' })).toBe(false)
    expect(isSaleOrder({ paymentStatus: 'REFUNDED', status: 'CANCELLED' })).toBe(false)
  })

  it('still counts a normal paid order as a sale', () => {
    for (const status of ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']) {
      expect(isSaleOrder({ paymentStatus: 'PAID', status })).toBe(true)
    }
  })

  it('exposes the same rule to every Prisma reader', () => {
    expect(SALE_ORDER_FILTER.paymentStatus).toEqual({ in: ['PAID'] })
    expect(SALE_ORDER_FILTER.status).toEqual({ notIn: ['CANCELLED'] })
  })
})

describe('wording for a cancelled order', () => {
  it("reads 'Cancelled, refund pending review' while the refund request waits", () => {
    expect(cancelledOrderLabel({ paymentStatus: 'PAID', status: 'CANCELLED' })).toBe(
      'Cancelled, refund pending review'
    )
  })

  it("reads 'Refunded' only once the refund has settled", () => {
    expect(cancelledOrderLabel({ paymentStatus: 'REFUNDED', status: 'CANCELLED' })).toBe(
      'Refunded'
    )
  })

  it("reads 'Cancelled' when nothing was charged", () => {
    expect(cancelledOrderLabel({ paymentStatus: 'PENDING', status: 'CANCELLED' })).toBe(
      'Cancelled'
    )
  })
})
