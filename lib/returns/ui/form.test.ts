import { describe, it, expect } from 'vitest'
import { validateReturnForm } from './form'

const base = {
  itemQuantity: 1,
  maxPesewas: 1000,
  maxRefundAmount: '10.00',
}

describe('validateReturnForm', () => {
  it('accepts a valid full-amount request', () => {
    const result = validateReturnForm({ ...base, reason: 'DAMAGED', requestedAmount: '10.00', quantity: 1 })
    expect(result.ok).toBe(true)
    expect(result.fieldErrors).toEqual({})
  })

  it('accepts a valid partial amount', () => {
    const result = validateReturnForm({
      ...base,
      reason: 'NOT_AS_DESCRIBED',
      requestedAmount: '5.50',
      quantity: 1,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a missing reason', () => {
    const result = validateReturnForm({ ...base, reason: '', requestedAmount: '10.00', quantity: 1 })
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.reason).toBe('Select a reason for the return')
  })

  it('rejects an empty amount', () => {
    const result = validateReturnForm({ ...base, reason: 'DAMAGED', requestedAmount: '', quantity: 1 })
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.amount).toBe('Enter an amount')
  })

  it('rejects too many decimals', () => {
    const result = validateReturnForm({ ...base, reason: 'DAMAGED', requestedAmount: '10.555', quantity: 1 })
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.amount).toBe('Amount must have at most two decimal places')
  })

  it('rejects zero and negative amounts', () => {
    for (const amount of ['0', '0.00', '-1', '-0.50']) {
      const result = validateReturnForm({ ...base, reason: 'DAMAGED', requestedAmount: amount, quantity: 1 })
      expect(result.ok).toBe(false)
      expect(result.fieldErrors.amount).toBe('Amount must be greater than zero')
    }
  })

  it('rejects non-numeric input', () => {
    const result = validateReturnForm({ ...base, reason: 'DAMAGED', requestedAmount: 'abc', quantity: 1 })
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.amount).toBe('Enter a valid amount')
  })

  it('rejects amounts above the max one pesewa either side', () => {
    const okAtMax = validateReturnForm({
      ...base,
      reason: 'DAMAGED',
      requestedAmount: '10.00',
      maxPesewas: 1000,
      maxRefundAmount: '10.00',
      quantity: 1,
    })
    expect(okAtMax.ok).toBe(true)

    const above = validateReturnForm({
      ...base,
      reason: 'DAMAGED',
      requestedAmount: '10.01',
      maxPesewas: 1000,
      maxRefundAmount: '10.00',
      quantity: 1,
    })
    expect(above.ok).toBe(false)
    expect(above.fieldErrors.amount).toBe('Amount cannot exceed 10.00')
  })

  it('requires quantity between 1 and item quantity when the item has more than one', () => {
    const tooHigh = validateReturnForm({ ...base, itemQuantity: 2, reason: 'DAMAGED', requestedAmount: '5.00', quantity: 3, maxPesewas: 5000, maxRefundAmount: '50.00' })
    expect(tooHigh.ok).toBe(false)
    expect(tooHigh.fieldErrors.quantity).toBe('Quantity must be between 1 and 2')

    const zero = validateReturnForm({ ...base, itemQuantity: 2, reason: 'DAMAGED', requestedAmount: '5.00', quantity: 0, maxPesewas: 5000, maxRefundAmount: '50.00' })
    expect(zero.ok).toBe(false)

    const valid = validateReturnForm({ ...base, itemQuantity: 2, reason: 'DAMAGED', requestedAmount: '5.00', quantity: 2, maxPesewas: 5000, maxRefundAmount: '50.00' })
    expect(valid.ok).toBe(true)
  })

  it('does not require quantity when the item quantity is one', () => {
    const result = validateReturnForm({ ...base, itemQuantity: 1, reason: 'DAMAGED', requestedAmount: '10.00', quantity: 999 })
    expect(result.ok).toBe(true)
    expect(result.fieldErrors.quantity).toBeUndefined()
  })

  it('combines multiple field errors', () => {
    const result = validateReturnForm({
      ...base,
      reason: '',
      requestedAmount: '',
      quantity: 5,
      itemQuantity: 2,
      maxPesewas: 100,
      maxRefundAmount: '1.00',
    })
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.reason).toBeDefined()
    expect(result.fieldErrors.amount).toBeDefined()
    expect(result.fieldErrors.quantity).toBeDefined()
  })
})
