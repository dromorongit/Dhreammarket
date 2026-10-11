import { describe, it, expect } from 'vitest'
import {
  allocatePesewas,
  Caps,
  RefundError,
  buildIdempotencyKey,
  canTransition,
  computeItemCap,
  guardWalletOrder,
  pesewasToGhs,
  round2,
  toPesewas,
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

    // item_a gross is 100 of 150, item_b gross is 50 of 150, so the 100 GHS
    // payment splits 66.66 / 33.34 in pesewas with the 1-pesewa remainder on
    // the last item. The old float pro-rata gave 66.67 / 33.33 and left a
    // stray pesewa unowned.
    expect(caps.itemCap('item_a')).toBe(66.66)
    // 66.66 cap minus 60 already refunded (50 processed + 10 pending).
    expect(caps.itemRemaining('item_a')).toBe(6.66)
    // The two caps sum exactly to the payment.
    expect(round2(caps.itemCap('item_a') + caps.itemCap('item_b'))).toBe(100)
    // A FAILED refund does not consume the cap.
    expect(caps.paymentRemaining).toBe(40)
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

describe('integer pesewa arithmetic', () => {
  it('converts a GHS amount to pesewas without floating point error', () => {
    expect(toPesewas(100)).toBe(10000)
    expect(toPesewas(0.01)).toBe(1)
    expect(toPesewas('102.07')).toBe(10207)
    expect(toPesewas(0)).toBe(0)
    expect(toPesewas(null)).toBe(0)
    expect(toPesewas(undefined)).toBe(0)
    // 30.6 is 30.599999999999998 in binary floating point; Math.round(30.6 * 100)
    // happens to save this one, but 100.07-style values are not always so lucky.
    expect(toPesewas(30.6)).toBe(3060)
    expect(pesewasToGhs(10207)).toBe(102.07)
    expect(pesewasToGhs(1)).toBe(0.01)
  })

  it('rejects amounts with more than two decimal places', () => {
    // A refund request below one pesewa cannot be honoured exactly, so it is
    // refused rather than silently rounded by the caps.
    const caps = Caps.forOrder({
      id: 'order_fine',
      total: 100,
      items: [makeItem('item_a', 100, 1)],
      payment: { id: 'pay_fine', amount: 100 },
      refunds: [],
    })

    expect(() => caps.validate([{ orderItemId: 'item_a', amount: 30.123 }])).toThrowError(
      expect.objectContaining({ code: 'INVALID_AMOUNT' })
    )
    expect(() => caps.validate([{ orderItemId: 'item_a', amount: 30.1 }])).not.toThrow()
  })
})

describe('pesewa allocation across order items', () => {
  it('splits 100.00 GHS across three equal items', () => {
    const alloc = allocatePesewas(
      [
        { orderItemId: 'a', grossPesewas: 3333 },
        { orderItemId: 'b', grossPesewas: 3333 },
        { orderItemId: 'c', grossPesewas: 3334 },
      ],
      10000
    )
    // Pro-rata floors to 3333 each, leaving 1 pesewa for the last item.
    expect([alloc.get('a'), alloc.get('b'), alloc.get('c')]).toEqual([3333, 3333, 3334])
    const sum = alloc.get('a')! + alloc.get('b')! + alloc.get('c')!
    expect(sum).toBe(10000)
  })

  it('allocates the 0.01 remainder to the last item for an uneven split', () => {
    const alloc = allocatePesewas(
      [
        { orderItemId: 'a', grossPesewas: 1 },
        { orderItemId: 'b', grossPesewas: 1 },
      ],
      1
    )
    // 1 pesewa over two equal items: the first floors to 0, the last takes it.
    expect([alloc.get('a'), alloc.get('b')]).toEqual([0, 1])
  })

  it('always allocates a sum equal to the payment, for every total', () => {
    const grosses = [
      { orderItemId: 'a', grossPesewas: 7 },
      { orderItemId: 'b', grossPesewas: 11 },
      { orderItemId: 'c', grossPesewas: 13 },
    ]
    for (let payment = 1; payment <= 5000; payment += 7) {
      const alloc = allocatePesewas(grosses, payment)
      const sum = alloc.get('a')! + alloc.get('b')! + alloc.get('c')!
      expect(sum).toBe(payment)
    }
  })

  it('keeps the item caps summing to the payment for a 102.07 uneven split', () => {
    const caps = Caps.forOrder({
      id: 'order_uneven',
      total: 90,
      items: [makeItem('item_a', 13.37, 2), makeItem('item_b', 41.99, 1), makeItem('item_c', 5.55, 3)],
      payment: { id: 'pay_uneven', amount: 102.07 },
      refunds: [],
    })
    const total = caps.itemCap('item_a') + caps.itemCap('item_b') + caps.itemCap('item_c')
    expect(round2(total)).toBe(102.07)
    expect(caps.paymentRemaining).toBe(102.07)
  })

  it('lets a whole-order refund cover the payment exactly and settle the order', () => {
    const caps = Caps.forOrder({
      id: 'order_whole',
      total: 100,
      items: [makeItem('item_a', 33.33, 1), makeItem('item_b', 33.33, 1), makeItem('item_c', 33.34, 1)],
      payment: { id: 'pay_whole', amount: 100 },
      refunds: [],
    })

    // Refunding everything left on every item must equal the payment exactly.
    const items = [
      { orderItemId: 'item_a', amount: caps.itemRemaining('item_a') },
      { orderItemId: 'item_b', amount: caps.itemRemaining('item_b') },
      { orderItemId: 'item_c', amount: caps.itemRemaining('item_c') },
    ]
    const totalPesewas = items.reduce((sum, item) => sum + toPesewas(item.amount), 0)
    expect(totalPesewas).toBe(toPesewas(100))
    // And the validation that gates settlement agrees.
    expect(() => caps.validate(items)).not.toThrow()
  })

  it('caps a partial refund per item', () => {
    const caps = Caps.forOrder({
      id: 'order_partial',
      total: 100,
      items: [makeItem('item_a', 30, 1), makeItem('item_b', 70, 1)],
      payment: { id: 'pay_partial', amount: 102 },
      refunds: [],
    })

    caps.validate([{ orderItemId: 'item_a', amount: 30.6 }])
    expect(() => caps.validate([{ orderItemId: 'item_a', amount: 30.61 }])).toThrowError(
      expect.objectContaining({ code: 'ITEM_CAP_EXCEEDED' })
    )
    // The payment cap also still holds: item_a's 30.6 plus item_b's 71.4 is 102.
    caps.validate([
      { orderItemId: 'item_a', amount: 30.6 },
      { orderItemId: 'item_b', amount: 71.4 },
    ])
    expect(() =>
      caps.validate([
        { orderItemId: 'item_a', amount: 30.6 },
        { orderItemId: 'item_b', amount: 71.41 },
      ])
    ).toThrowError(expect.objectContaining({ code: 'ITEM_CAP_EXCEEDED' }))
  })
})
