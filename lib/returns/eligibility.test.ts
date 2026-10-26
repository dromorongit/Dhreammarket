import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { checkReturnEligibility } from '@/lib/returns/eligibility'

const NOW = new Date('2026-10-25T12:00:00.000Z')
const DELIVERED = new Date('2026-10-20T10:00:00.000Z')
const WINDOW_DAYS = 7

function baseInput(overrides: any = {}) {
  const item = {
    id: 'oi_1',
    price: 100,
    quantity: 1,
    deliveredAt: DELIVERED,
    ...(overrides.item ?? {}),
  }
  const order = {
    id: 'order_1',
    status: 'DELIVERED',
    paymentStatus: 'PAID',
    total: 100,
    items: [{ id: 'oi_1', price: 100, quantity: 1 }],
    payment: { id: 'pay_1', amount: 100 },
    refunds: [],
    ...(overrides.order ?? {}),
  }
  const product = { isReturnable: true, ...(overrides.product ?? {}) }
  const result: any = {
    item,
    order,
    product,
    existingRequests: [],
    now: NOW,
    windowDays: WINDOW_DAYS,
  }
  for (const k of Object.keys(overrides)) {
    if (!['item', 'order', 'product', 'root'].includes(k)) result[k] = overrides[k]
  }
  if (overrides.root) Object.assign(result, overrides.root)
  return result
}

describe('checkReturnEligibility', () => {
  it('is eligible with the full remaining amount as a Decimal', () => {
    const r = checkReturnEligibility(baseInput())
    expect(r.eligible).toBe(true)
    expect((r as any).maxRefundAmount.toString()).toBe('100')
  })

  it('preserves Decimal remaining amounts', () => {
    const r = checkReturnEligibility(
      baseInput({
        order: { total: 10, items: [{ id: 'oi_1', price: 10, quantity: 1 }], payment: { amount: 10 } },
      })
    )
    expect(r.eligible).toBe(true)
    expect((r as any).maxRefundAmount.toString()).toBe('10')
  })

  it('INVALID_DELIVERY_DATE for null deliveredAt', () => {
    const r = checkReturnEligibility(baseInput({ item: { deliveredAt: null } }))
    expect(r.eligible).toBe(false)
    expect(r.reason).toBe('INVALID_DELIVERY_DATE')
  })

  it('INVALID_DELIVERY_DATE for future deliveredAt', () => {
    const r = checkReturnEligibility(
      baseInput({ item: { deliveredAt: new Date(NOW.getTime() + 86400000) } })
    )
    expect(r.eligible).toBe(false)
    expect(r.reason).toBe('INVALID_DELIVERY_DATE')
  })

  it('NOT_DELIVERED for non-delivered order statuses', () => {
    for (const s of ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED']) {
      const r = checkReturnEligibility(baseInput({ order: { status: s } }))
      expect(r.eligible).toBe(false)
      expect(r.reason).toBe('NOT_DELIVERED')
    }
  })

  it('ORDER_NOT_PAID for an unpaid order', () => {
    const r = checkReturnEligibility(baseInput({ order: { paymentStatus: 'UNPAID' } }))
    expect(r.eligible).toBe(false)
    expect(r.reason).toBe('ORDER_NOT_PAID')
  })

  it('NOT_RETURNABLE_PRODUCT when isReturnable is false', () => {
    const r = checkReturnEligibility(baseInput({ product: { isReturnable: false } }))
    expect(r.eligible).toBe(false)
    expect(r.reason).toBe('NOT_RETURNABLE_PRODUCT')
  })

  it('WINDOW_EXPIRED one second after the boundary', () => {
    const deadline = new Date(DELIVERED.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const r = checkReturnEligibility(baseInput({ root: { now: new Date(deadline.getTime() + 1000) } }))
    expect(r.eligible).toBe(false)
    expect(r.reason).toBe('WINDOW_EXPIRED')
  })

  it('is eligible exactly at the window boundary (now === deadline)', () => {
    const deadline = new Date(DELIVERED.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const r = checkReturnEligibility(baseInput({ root: { now: deadline } }))
    expect(r.eligible).toBe(true)
  })

  it('is eligible one second before the boundary', () => {
    const deadline = new Date(DELIVERED.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const r = checkReturnEligibility(baseInput({ root: { now: new Date(deadline.getTime() - 1000) } }))
    expect(r.eligible).toBe(true)
  })

  it('FULLY_REFUNDED when alreadyRefunded reaches the cap', () => {
    const r = checkReturnEligibility(baseInput({ root: { alreadyRefunded: 100 } }))
    expect(r.eligible).toBe(false)
    expect(r.reason).toBe('FULLY_REFUNDED')
  })

  it('is eligible when partially refunded with a remaining amount', () => {
    const r = checkReturnEligibility(baseInput({ root: { alreadyRefunded: 30 } }))
    expect(r.eligible).toBe(true)
    expect((r as any).maxRefundAmount.toString()).toBe('70')
  })

  it('OPEN_REQUEST_EXISTS for every open status', () => {
    for (const status of ['PENDING', 'ITEM_IN_TRANSIT', 'ITEM_RECEIVED', 'AWAITING_REFUND', 'ESCALATED']) {
      const r = checkReturnEligibility(baseInput({ existingRequests: [{ status, orderItemId: 'oi_1' }] }))
      expect(r.eligible).toBe(false)
      expect(r.reason).toBe('OPEN_REQUEST_EXISTS')
    }
  })

  it('OPEN_REQUEST_EXISTS for an open request without an orderItemId', () => {
    const r = checkReturnEligibility(baseInput({ existingRequests: [{ status: 'PENDING' }] }))
    expect(r.eligible).toBe(false)
    expect(r.reason).toBe('OPEN_REQUEST_EXISTS')
  })

  it('terminal requests do not block eligibility', () => {
    const r = checkReturnEligibility(
      baseInput({ existingRequests: [{ status: 'REJECTED', orderItemId: 'oi_1' }] })
    )
    expect(r.eligible).toBe(true)
  })
})
