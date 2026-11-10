import { describe, it, expect } from 'vitest'
import { getStatusCopy, STATUS_COPY, allStatusesWithCopy } from './status-copy'
import type { ReturnStatus } from '@/lib/returns/state-machine'

const STATUSES: ReturnStatus[] = [
  'PENDING',
  'ITEM_IN_TRANSIT',
  'ITEM_RECEIVED',
  'AWAITING_REFUND',
  'ESCALATED',
  'REJECTED',
  'CLOSED',
]

describe('status-copy', () => {
  it('has copy for every ReturnStatus (exhaustive)', () => {
    for (const status of STATUSES) {
      const copy = STATUS_COPY[status]
      expect(copy.label.length).toBeGreaterThan(0)
      expect(copy.description.length).toBeGreaterThan(0)
      expect(copy.nextStep.length).toBeGreaterThan(0)
      expect(['info', 'success', 'warning', 'danger', 'neutral']).toContain(copy.tone)
    }
  })

  it('allStatusesWithCopy covers every status', () => {
    const covered = allStatusesWithCopy().map((e) => e.status)
    expect(covered.sort()).toEqual([...STATUSES].sort())
  })

  it('returns known copy for PENDING', () => {
    expect(getStatusCopy('PENDING').label).toBe('Waiting for the seller')
  })

  it('returns safe default for unknown status', () => {
    const copy = getStatusCopy('UNKNOWN_STATUS')
    expect(copy.label).toBe('Return request')
    expect(copy.tone).toBe('neutral')
  })

  describe('business day return review', () => {
    it('tells the customer the seller has 1 business day when the rule applies', () => {
      const copy = getStatusCopy('PENDING', {
        businessDayRule: true,
        escalationDeadline: new Date('2026-10-27T17:00:00.000Z'),
      })
      expect(copy.description).toBe('The seller has 1 business day to respond to your return request.')
    })

    it('keeps the hours-based copy when the rule does not apply', () => {
      const copy = getStatusCopy('PENDING', { businessDayRule: false })
      expect(copy.description).toContain('hours to respond to your return request')
    })

    it('keeps the hours-based copy when no context is given', () => {
      const copy = getStatusCopy('PENDING')
      expect(copy.description).toContain('hours to respond to your return request')
    })
  })
})
