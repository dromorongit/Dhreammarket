import { describe, it, expect } from 'vitest'
import { vendorRejectedOrdersWhere } from '@/lib/trust-metrics'

describe('vendorRejectedOrdersWhere', () => {
  it('returns correct where clause with storeId (both some and every)', () => {
    const where = vendorRejectedOrdersWhere('store-123')

    expect(where).toEqual({
      vendorRejected: true,
      paymentStatus: { in: ['PAID', 'REFUNDED'] },
      items: {
        some: {
          product: {
            storeId: 'store-123',
          },
        },
        every: {
          product: {
            storeId: 'store-123',
          },
        },
      },
    })
  })

  it('includes paymentStatus in PAID and REFUNDED', () => {
    const where = vendorRejectedOrdersWhere('any-store')
    expect(where.paymentStatus).toEqual({ in: ['PAID', 'REFUNDED'] })
  })

  it('includes vendorRejected true', () => {
    const where = vendorRejectedOrdersWhere('any-store')
    expect(where.vendorRejected).toBe(true)
  })

  it('includes BOTH items.some AND items.every with storeId', () => {
    const where = vendorRejectedOrdersWhere('store-456')
    expect(where.items).toHaveProperty('some')
    expect(where.items).toHaveProperty('every')
    expect(where.items.some).toEqual({
      product: { storeId: 'store-456' },
    })
    expect(where.items.every).toEqual({
      product: { storeId: 'store-456' },
    })
  })

  it('uses different storeId per call', () => {
    const where1 = vendorRejectedOrdersWhere('store-a')
    const where2 = vendorRejectedOrdersWhere('store-b')

    expect(where1.items.some.product.storeId).toBe('store-a')
    expect(where1.items.every.product.storeId).toBe('store-a')
    expect(where2.items.some.product.storeId).toBe('store-b')
    expect(where2.items.every.product.storeId).toBe('store-b')
  })
})