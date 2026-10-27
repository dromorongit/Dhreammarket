import { describe, it, expect } from 'vitest'
import {
  SELLER_STATUS_COPY,
  getSellerStatusCopy,
  sellerStatusIsActionable,
} from './seller-copy'

const ALL_STATUSES = [
  'PENDING',
  'ITEM_IN_TRANSIT',
  'ITEM_RECEIVED',
  'AWAITING_REFUND',
  'ESCALATED',
  'REJECTED',
  'CLOSED',
] as const

describe('SELLER_STATUS_COPY exhaustiveness', () => {
  it('covers every ReturnStatus exactly', () => {
    expect(Object.keys(SELLER_STATUS_COPY).sort()).toEqual([...ALL_STATUSES].sort())
  })

  it('has complete copy for every status', () => {
    for (const status of ALL_STATUSES) {
      const copy = SELLER_STATUS_COPY[status]
      expect(copy.label).toBeTruthy()
      expect(copy.description).toBeTruthy()
      expect(copy.nextStep).toBeTruthy()
      expect(['info', 'success', 'warning', 'danger', 'neutral']).toContain(copy.tone)
    }
  })
})

describe('getSellerStatusCopy', () => {
  it.each(ALL_STATUSES)('returns copy for %s', (status) => {
    const copy = getSellerStatusCopy(status)
    expect(copy.label).toBeTruthy()
  })

  it('returns a neutral fallback for unknown statuses', () => {
    const copy = getSellerStatusCopy('NOT_A_STATUS' as any)
    expect(copy.tone).toBe('neutral')
  })
})

describe('sellerStatusIsActionable', () => {
  it('is actionable only for PENDING', () => {
    expect(sellerStatusIsActionable('PENDING')).toBe(true)
    expect(sellerStatusIsActionable('ESCALATED')).toBe(false)
    expect(sellerStatusIsActionable('CLOSED')).toBe(false)
  })
})
