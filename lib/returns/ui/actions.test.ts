import { describe, it, expect } from 'vitest'
import {
  available,
  actionLabel,
  actionVariant,
  confirmationText,
} from './actions'

const ALL_STATUSES = [
  'PENDING',
  'ITEM_IN_TRANSIT',
  'ITEM_RECEIVED',
  'AWAITING_REFUND',
  'ESCALATED',
  'REJECTED',
  'CLOSED',
] as const

describe('available action matrix', () => {
  const overdue = new Date('2026-10-25T12:00:00.000Z').getTime() - 1000
  const notOverdue = new Date('2026-10-25T12:00:00.000Z').getTime() + 1000

  it('seller: only PENDING is actionable', () => {
    for (const status of ALL_STATUSES) {
      const actions = available(status, 'VENDOR')
      if (status === 'PENDING') {
        expect(actions).toEqual(['RESPOND'])
      } else {
        expect(actions).toEqual([])
      }
    }
  })

  it('admin: ESCALATED -> approve + deny', () => {
    expect(available('ESCALATED', 'ADMIN')).toEqual(['APPROVE', 'DENY'])
  })

  it('admin: PENDING overdue boundary one second past -> escalate', () => {
    expect(available('PENDING', 'ADMIN', { overdue: true })).toEqual(['ESCALATE'])
  })

  it('admin: PENDING not overdue one second before deadline -> no escalate', () => {
    expect(available('PENDING', 'ADMIN', { overdue: false })).toEqual([])
    expect(available('PENDING', 'ADMIN', {})).toEqual([])
  })

  it('admin: AWAITING_REFUND with PROCESSED refund -> close', () => {
    expect(available('AWAITING_REFUND', 'ADMIN', { refundStatus: 'PROCESSED' })).toEqual([
      'CLOSE',
    ])
  })

  it('admin: AWAITING_REFUND without processed refund -> no close', () => {
    expect(available('AWAITING_REFUND', 'ADMIN', { refundStatus: 'PENDING' })).toEqual([])
    expect(available('AWAITING_REFUND', 'ADMIN', { refundStatus: null })).toEqual([])
    expect(available('AWAITING_REFUND', 'ADMIN', {})).toEqual([])
  })

  it('admin: terminal and reserved statuses -> no actions', () => {
    for (const status of ['CLOSED', 'REJECTED', 'ITEM_IN_TRANSIT', 'ITEM_RECEIVED']) {
      expect(available(status as any, 'ADMIN')).toEqual([])
    }
  })
})

describe('actionLabel and actionVariant', () => {
  it('covers every action', () => {
    const actions = ['RESPOND', 'ESCALATE', 'APPROVE', 'DENY', 'CLOSE'] as const
    for (const action of actions) {
      expect(actionLabel(action)).toBeTruthy()
      expect(['primary', 'outline', 'danger', 'ghost']).toContain(actionVariant(action))
    }
  })
})

describe('confirmationText', () => {
  it('seller approve states exact GHS amount and earnings deduction', () => {
    const text = confirmationText({ decision: 'APPROVE', amountPesewas: 1050, role: 'VENDOR' })
    expect(text).toContain('10.50')
    expect(text).toContain('Refund')
    expect(text).toContain('to the customer now')
    expect(text).toContain('deducted from your earnings')
  })

  it('admin approve states exact amount without earnings text', () => {
    const text = confirmationText({ decision: 'APPROVE', amountPesewas: 1050, role: 'ADMIN' })
    expect(text).toContain('10.50')
    expect(text).toContain('to the customer now')
    expect(text).not.toContain('deducted from your earnings')
  })

  it('formats awkward amounts', () => {
    const onePesewa = confirmationText({
      decision: 'APPROVE',
      amountPesewas: 1,
      role: 'VENDOR',
    })
    expect(onePesewa).toContain('0.01')
    const noAmount = confirmationText({ decision: 'APPROVE', amountPesewas: null, role: 'ADMIN' })
    expect(noAmount).toContain('Refund the customer now')
  })

  it('deny confirmation never mentions an amount', () => {
    const vendorDeny = confirmationText({
      decision: 'DENY',
      amountPesewas: 5000,
      role: 'VENDOR',
    })
    const adminDeny = confirmationText({
      decision: 'DENY',
      amountPesewas: 5000,
      role: 'ADMIN',
    })
    expect(vendorDeny).toContain('customer will not be refunded')
    expect(adminDeny).toContain('customer will not be refunded')
    expect(vendorDeny).not.toContain('50.00')
    expect(adminDeny).not.toContain('50.00')
  })
})
