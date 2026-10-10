import { describe, it, expect } from 'vitest'
import {
  Caps,
  RefundError,
  buildIdempotencyKey,
  canTransition,
  computeItemCap,
  guardWalletOrder,
  round2,
  type RefundSource,
} from '@/lib/refunds/process-refund'

describe('refund idempotency keys', () => {
  it('returns the client requestId verbatim for a manual refund', () => {
    const requestId = '0f1e2d3c-4b5a-6978-8877-665544332211'
    expect(buildIdempotencyKey('MANUAL', requestId)).toBe(requestId)
  })

  it('builds the deterministic keys for automatic flows', () => {
    expect(buildIdempotencyKey('RETURN', 'rr_123')).toBe('RETURN:rr_123')
    expect(buildIdempotencyKey('VENDOR_REJECTION', 'oi_9')).toBe('VENDOR_REJECTION:oi_9')
    expect(buildIdempotencyKey('CUSTOMER_CANCEL', 'oi_17')).toBe('CUSTOMER_CANCEL:oi_17')
  })

  it('rejects an unknown source', () => {
    expect(() => buildIdempotencyKey('MYSTERY' as RefundSource, 'x')).toThrow()
  })
})

describe('refund status monotonicity', () => {
  it('allows advancing and forbids moving backwards', () => {
    expect(canTransition('PENDING', 'PROCESSING')).toBe(true)
    expect(canTransition('PROCESSING', 'PROCESSED')).toBe(true)
    expect(canTransition('NEEDS_ATTENTION', 'PROCESSING')).toBe(true)
    expect(canTransition('NEEDS_ATTENTION', 'PROCESSED')).toBe(true)
    expect(canTransition('PROCESSED', 'FAILED')).toBe(false)
    expect(canTransition('FAILED', 'PROCESSED')).toBe(false)
    expect(canTransition('PROCESSING', 'PENDING')).toBe(false)
  })

  it('treats staying put as a no-op transition', () => {
    expect(canTransition('PROCESSED', 'PROCESSED')).toBe(true)
  })
})

describe('wallet guard', () => {
  it('refuses an order paid partly or fully with wallet', () => {
    const error = guardWalletOrder({ walletAmountApplied: 25.5 })
    expect(error).toBeInstanceOf(RefundError)
    expect(error?.status).toBe(409)
    expect(error?.message).toBe('paid partly or fully with wallet; refund manually')
  })

  it('allows an order with no wallet amount applied', () => {
    expect(guardWalletOrder({ walletAmountApplied: 0 })).toBeNull()
    expect(guardWalletOrder({ walletAmountApplied: null })).toBeNull()
    expect(guardWalletOrder({ walletAmountApplied: undefined })).toBeNull()
  })
})

describe('per-item pro-rated cap', () => {
  it('apportions the charged amount by the item gross share', () => {
    // 30 of a 100 GHS order is 30% of the 102 GHS charged.
    expect(computeItemCap(30, 100, 102)).toBe(30.6)
    expect(computeItemCap(50, 100, 100)).toBe(50)
    expect(computeItemCap(100, 0, 100)).toBe(0)
    expect(computeItemCap(0, 100, 100)).toBe(0)
  })
})

function makeItem(id: string, price: number, quantity: number) {
  return { id, price, quantity }
}

describe('Caps', () => {
  it('derives a payment cap and a per-item cap from what was actually charged', () => {
    const caps = Caps.forOrder({
      id: 'order_1',
      total: 100,
      items: [makeItem('item_a', 30, 1), makeItem('item_b', 70, 1)],
      payment: { id: 'pay_1', amount: 102 },
      refunds: [],
    })

    expect(caps.paymentRemaining).toBe(102)
    expect(caps.itemCap('item_a')).toBe(30.6)
    expect(caps.itemCap('item_b')).toBe(71.4)
    expect(caps.itemRemaining('item_a')).toBe(30.6)
    expect(caps.itemRemaining('item_b')).toBe(71.4)
  })

  it('subtracts already settled refunds from the per-item cap', () => {
    const caps = Caps.forOrder({
      id: 'order_2',
      total: 100,
      items: [makeItem('item_a', 50, 2), makeItem('item_b', 50, 1)],
      payment: { id: 'pay_2', amount: 100 },
      refunds: [
        { amount: 50, status: 'PROCESSED', orderItemId: 'item_a' },
        { amount: 10, status: 'PENDING', orderItemId: 'item_a' },
      ],
    })

    // item_a gross is 100 of 150 total, so its share of 100 GHS is 66.67.
    expect(round2(caps.itemCap('item_a'))).toBe(66.67)
    expect(round2(caps.itemRemaining('item_a'))).toBe(6.67)
    // A FAILED refund does not consume the cap.
    expect(round2(caps.paymentRemaining)).toBe(40)
  })

  it('ignores failed refunds when computing what is left to refund', () => {
    const caps = Caps.forOrder({
      id: 'order_3',
      total: 100,
      items: [makeItem('item_a', 100, 1)],
      payment: { id: 'pay_3', amount: 100 },
      refunds: [{ amount: 100, status: 'FAILED', orderItemId: 'item_a' }],
    })

    expect(caps.paymentRemaining).toBe(100)
    expect(caps.itemRemaining('item_a')).toBe(100)
  })

  it('refuses a refund that exceeds the per-item pro-rated share', () => {
    const caps = Caps.forOrder({
      id: 'order_4',
      total: 100,
      items: [makeItem('item_a', 30, 1), makeItem('item_b', 70, 1)],
      payment: { id: 'pay_4', amount: 102 },
      refunds: [],
    })

    let thrown: unknown
    try {
      caps.validate([{ orderItemId: 'item_a', amount: 31 }])
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(RefundError)
    expect((thrown as RefundError).code).toBe('ITEM_CAP_EXCEEDED')
    expect((thrown as RefundError).message).toContain('exceeds the refundable cap 30.6')
  })

  it('refuses a refund total that exceeds the payment-level cap', () => {
    const caps = Caps.forOrder({
      id: 'order_5',
      total: 100,
      items: [makeItem('item_a', 30, 1), makeItem('item_b', 70, 1)],
      payment: { id: 'pay_5', amount: 100 },
      refunds: [{ amount: 80, status: 'PROCESSED', orderItemId: 'item_b' }],
    })

    let thrown: unknown
    try {
      caps.validate([{ orderItemId: 'item_a', amount: 25 }])
    } catch (error) {
      thrown = error
    }
    expect((thrown as RefundError).code).toBe('PAYMENT_CAP_EXCEEDED')
  })

  it('sums several rows for the same order item against one per-item cap', () => {
    const caps = Caps.forOrder({
      id: 'order_6',
      total: 100,
      items: [makeItem('item_a', 100, 1)],
      payment: { id: 'pay_6', amount: 100 },
      refunds: [],
    })

    caps.validate([
      { orderItemId: 'item_a', amount: 60 },
      { orderItemId: 'item_a', amount: 40 },
    ])

    expect(() =>
      caps.validate([
        { orderItemId: 'item_a', amount: 60 },
        { orderItemId: 'item_a', amount: 41 },
      ])
    ).toThrowError(RefundError)
  })

  it('rejects a non-positive amount and an unknown order item', () => {
    const caps = Caps.forOrder({
      id: 'order_7',
      total: 100,
      items: [makeItem('item_a', 100, 1)],
      payment: { id: 'pay_7', amount: 100 },
      refunds: [],
    })

    expect(() => caps.validate([{ orderItemId: 'item_a', amount: 0 }])).toThrowError(
      expect.objectContaining({ code: 'INVALID_AMOUNT', status: 400 })
    )
    expect(() => caps.validate([{ orderItemId: 'nope', amount: 5 }])).toThrowError(
      expect.objectContaining({ code: 'ITEM_NOT_REFUNDABLE', status: 400 })
    )
  })
})

describe('round2', () => {
  it('keeps two decimal places without floating point noise', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(round2(30.6000000001)).toBe(30.6)
  })
})
