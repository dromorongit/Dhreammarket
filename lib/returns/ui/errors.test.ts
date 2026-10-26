import { describe, it, expect } from 'vitest'
import {
  eligibilityReasonToCopy,
  apiErrorToCopy,
  networkErrorCopy,
  allEligibilityReasonsWithCopy,
} from './errors'
import type { EligibilityReason } from '@/lib/returns/types'

const REASONS: EligibilityReason[] = [
  'NOT_DELIVERED',
  'WINDOW_EXPIRED',
  'NOT_RETURNABLE_PRODUCT',
  'ORDER_NOT_PAID',
  'FULLY_REFUNDED',
  'OPEN_REQUEST_EXISTS',
  'INVALID_DELIVERY_DATE',
]

describe('errors', () => {
  it('has copy for every eligibility reason (exhaustive)', () => {
    for (const reason of REASONS) {
      const copy = eligibilityReasonToCopy(reason)
      expect(typeof copy.message).toBe('string')
      expect(copy.message.length).toBeGreaterThan(0)
    }
  })

  it('allEligibilityReasonsWithCopy covers every reason', () => {
    const covered = allEligibilityReasonsWithCopy().map((e) => e.reason)
    expect([...covered].sort()).toEqual([...REASONS].sort())
  })

  it('maps eligibility reasons to plain-language copy', () => {
    expect(eligibilityReasonToCopy('WINDOW_EXPIRED').message).toContain('window')
    expect(eligibilityReasonToCopy('OPEN_REQUEST_EXISTS').action).toContain('My Returns')
  })

  it('maps API status codes', () => {
    expect(apiErrorToCopy(401).message).toContain('sign in')
    expect(apiErrorToCopy(403).message).toContain('not allowed')
    expect(apiErrorToCopy(404).message).toContain('could not find')
    expect(apiErrorToCopy(409).message).toContain('already being handled')
    expect(apiErrorToCopy(409, 'OPEN_REQUEST_EXISTS').message).toContain('open return request')
    expect(apiErrorToCopy(500).message).toContain('try again later')
    expect(apiErrorToCopy(400).message).toContain('Something went wrong')
  })

  it('maps network failures without raw messages', () => {
    const copy = networkErrorCopy()
    expect(copy.message).toContain('internet')
    expect(copy.action).toContain('try again')
  })
})
