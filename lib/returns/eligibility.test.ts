import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { checkReturnEligibility } from '@/lib/returns/eligibility'
import type { EligibilityReason, EligibilityResult } from '@/lib/returns/types'

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

/**
 * Narrow the EligibilityResult union: only read `reason` once `eligible` is
 * asserted false. `expect(...)` does not narrow types, so an explicit check
 * is required before accessing the discriminated `reason` property.
 */
function assertIneligible(r: EligibilityResult, reason: EligibilityReason): void {
  expect(r.eligible).toBe(false)
  if (!r.eligible) {
    expect(r.reason).toBe(reason)
  }
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
    assertIneligible(r, 'INVALID_DELIVERY_DATE')
  })

  it('INVALID_DELIVERY_DATE for future deliveredAt', () => {
    const r = checkReturnEligibility(
      baseInput({ item: { deliveredAt: new Date(NOW.getTime() + 86400000) } })
    )
    assertIneligible(r, 'INVALID_DELIVERY_DATE')
  })

  it('NOT_DELIVERED for non-delivered order statuses', () => {
    for (const s of ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED']) {
      const r = checkReturnEligibility(baseInput({ order: { status: s } }))
      assertIneligible(r, 'NOT_DELIVERED')
    }
  })

  it('ORDER_NOT_PAID for an unpaid order', () => {
    const r = checkReturnEligibility(baseInput({ order: { paymentStatus: 'UNPAID' } }))
    assertIneligible(r, 'ORDER_NOT_PAID')
  })

  it('NOT_RETURNABLE_PRODUCT when isReturnable is false', () => {
    const r = checkReturnEligibility(baseInput({ product: { isReturnable: false } }))
    assertIneligible(r, 'NOT_RETURNABLE_PRODUCT')
  })

  it('WINDOW_EXPIRED one second after the boundary', () => {
    const deadline = new Date(DELIVERED.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const r = checkReturnEligibility(baseInput({ root: { now: new Date(deadline.getTime() + 1000) } }))
    assertIneligible(r, 'WINDOW_EXPIRED')
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
    assertIneligible(r, 'FULLY_REFUNDED')
  })

  it('is eligible when partially refunded with a remaining amount', () => {
    const r = checkReturnEligibility(baseInput({ root: { alreadyRefunded: 30 } }))
    expect(r.eligible).toBe(true)
    expect((r as any).maxRefundAmount.toString()).toBe('70')
  })

  it('OPEN_REQUEST_EXISTS for every open status', () => {
    for (const status of ['PENDING', 'ITEM_IN_TRANSIT', 'ITEM_RECEIVED', 'AWAITING_REFUND', 'ESCALATED']) {
      const r = checkReturnEligibility(baseInput({ existingRequests: [{ status, orderItemId: 'oi_1' }] }))
      assertIneligible(r, 'OPEN_REQUEST_EXISTS')
    }
  })

  it('OPEN_REQUEST_EXISTS for an open request without an orderItemId', () => {
    const r = checkReturnEligibility(baseInput({ existingRequests: [{ status: 'PENDING' }] }))
    assertIneligible(r, 'OPEN_REQUEST_EXISTS')
  })

  it('terminal requests do not block eligibility', () => {
    const r = checkReturnEligibility(
      baseInput({ existingRequests: [{ status: 'REJECTED', orderItemId: 'oi_1' }] })
    )
    expect(r.eligible).toBe(true)
  })

  describe('location-based return window (completedAt)', () => {
    const CUTOVER = new Date('2026-09-01T00:00:00.000Z')
    const COMPLETED_AT = new Date('2026-10-20T10:00:00.000Z')
    const POST_CUTOVER_CREATED_AT = new Date('2026-10-01T00:00:00.000Z')
    const PRE_CUTOVER_CREATED_AT = new Date('2026-08-01T00:00:00.000Z')

    function locationInput(overrides: any = {}) {
      return baseInput({
        root: {
          now: NOW,
          isLocationReturnWindowEnabled: true,
          systemCutoverTimestamp: CUTOVER,
          ...(overrides.root ?? {}),
        },
        order: {
          createdAt: POST_CUTOVER_CREATED_AT,
          completedAt: COMPLETED_AT,
          ...(overrides.order ?? {}),
        },
        item: overrides.item,
        product: overrides.product,
      })
    }

    it('Greater Accra: eligible at 23h from completedAt (1-day window)', () => {
      const now = new Date(COMPLETED_AT.getTime() + 23 * 60 * 60 * 1000)
      const r = checkReturnEligibility(locationInput({ root: { now }, order: { customerRegion: 'Greater Accra' } }))
      expect(r.eligible).toBe(true)
    })

    it('Greater Accra: ineligible at 25h from completedAt', () => {
      const now = new Date(COMPLETED_AT.getTime() + 25 * 60 * 60 * 1000)
      const r = checkReturnEligibility(locationInput({ root: { now }, order: { customerRegion: 'Greater Accra' } }))
      assertIneligible(r, 'WINDOW_EXPIRED')
    })

    it('other region: eligible at 71h from completedAt (3-day window)', () => {
      const now = new Date(COMPLETED_AT.getTime() + 71 * 60 * 60 * 1000)
      const r = checkReturnEligibility(locationInput({ root: { now }, order: { customerRegion: 'Ashanti' } }))
      expect(r.eligible).toBe(true)
    })

    it('other region: ineligible at 73h from completedAt', () => {
      const now = new Date(COMPLETED_AT.getTime() + 73 * 60 * 60 * 1000)
      const r = checkReturnEligibility(locationInput({ root: { now }, order: { customerRegion: 'Ashanti' } }))
      assertIneligible(r, 'WINDOW_EXPIRED')
    })

    it('completedAt null is ineligible with INVALID_COMPLETION_DATE', () => {
      const r = checkReturnEligibility(locationInput({ order: { completedAt: null } }))
      assertIneligible(r, 'INVALID_COMPLETION_DATE')
    })

    it('region variants match Greater Accra (1-day window)', () => {
      const now = new Date(COMPLETED_AT.getTime() + 25 * 60 * 60 * 1000)
      for (const region of ['Greater Accra', 'greater accra region', ' GREATER  ACCRA ']) {
        const r = checkReturnEligibility(locationInput({ root: { now }, order: { customerRegion: region } }))
        assertIneligible(r, 'WINDOW_EXPIRED')
      }
    })

    it('Ashanti and missing region use the 3-day window', () => {
      const now = new Date(COMPLETED_AT.getTime() + 25 * 60 * 60 * 1000)
      for (const region of ['Ashanti', null]) {
        const r = checkReturnEligibility(locationInput({ root: { now }, order: { customerRegion: region } }))
        expect(r.eligible).toBe(true)
      }
    })

    it('pre-cutover order keeps the deliveredAt-based window regardless of the flag', () => {
      const now = new Date(DELIVERED.getTime() + 6 * 24 * 60 * 60 * 1000)
      const r = checkReturnEligibility(
        locationInput({ root: { now }, order: { createdAt: PRE_CUTOVER_CREATED_AT, completedAt: COMPLETED_AT } })
      )
      expect(r.eligible).toBe(true)
    })
  })
})
