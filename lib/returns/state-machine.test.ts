import { describe, it, expect } from 'vitest'
import {
  canTransition,
  nextActionsFor,
  TRANSITION_TABLE,
  type ReturnStatus,
} from '@/lib/returns/state-machine'

const STATUSES: ReturnStatus[] = [
  'PENDING',
  'ITEM_IN_TRANSIT',
  'ITEM_RECEIVED',
  'AWAITING_REFUND',
  'ESCALATED',
  'REJECTED',
  'CLOSED',
]
const ACTORS = ['CUSTOMER', 'VENDOR', 'ADMIN', 'SYSTEM'] as const

const ALLOWED: Record<string, Record<string, string[]>> = {
  PENDING: { VENDOR: ['AWAITING_REFUND', 'ESCALATED'], SYSTEM: ['ESCALATED'], ADMIN: ['ESCALATED'] },
  ESCALATED: { ADMIN: ['AWAITING_REFUND', 'REJECTED'] },
}

describe('state machine transition table', () => {
  it('matches docs/returns-disputes/DESIGN.md exactly', () => {
    const expected = [
      { from: 'PENDING', to: 'AWAITING_REFUND', actor: 'VENDOR' },
      { from: 'PENDING', to: 'ESCALATED', actor: 'VENDOR' },
      { from: 'PENDING', to: 'ESCALATED', actor: 'SYSTEM' },
      { from: 'PENDING', to: 'ESCALATED', actor: 'ADMIN' },
      { from: 'ESCALATED', to: 'AWAITING_REFUND', actor: 'ADMIN' },
      { from: 'ESCALATED', to: 'REJECTED', actor: 'ADMIN' },
    ]
    expect(TRANSITION_TABLE).toEqual(expected)
  })

  it('allows exactly the table pairs and rejects every other pair', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        for (const actor of ACTORS) {
          const allowed = ALLOWED[from]?.[actor]?.includes(to) ?? false
          expect(canTransition(from, to, actor)).toBe(allowed)
        }
      }
    }
  })

  it('a customer cannot approve or initiate any transition', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        expect(canTransition(from, to, 'CUSTOMER')).toBe(false)
      }
    }
  })

  it('a vendor cannot decide an admin escalation', () => {
    expect(canTransition('ESCALATED', 'AWAITING_REFUND', 'VENDOR')).toBe(false)
    expect(canTransition('ESCALATED', 'REJECTED', 'VENDOR')).toBe(false)
    expect(canTransition('PENDING', 'AWAITING_REFUND', 'VENDOR')).toBe(true)
    expect(canTransition('PENDING', 'ESCALATED', 'VENDOR')).toBe(true)
  })

  it('terminal states have no outgoing transitions', () => {
    for (const to of STATUSES) {
      for (const actor of ACTORS) {
        expect(canTransition('REJECTED', to, actor)).toBe(false)
        expect(canTransition('CLOSED', to, actor)).toBe(false)
      }
    }
  })

  it('nextActionsFor returns only table targets per actor', () => {
    expect(nextActionsFor('PENDING', 'VENDOR').sort()).toEqual(['AWAITING_REFUND', 'ESCALATED'])
    expect(nextActionsFor('PENDING', 'SYSTEM')).toEqual(['ESCALATED'])
    expect(nextActionsFor('PENDING', 'ADMIN')).toEqual(['ESCALATED'])
    expect(nextActionsFor('PENDING', 'CUSTOMER')).toEqual([])
    expect(nextActionsFor('ESCALATED', 'ADMIN').sort()).toEqual(['AWAITING_REFUND', 'REJECTED'])
    expect(nextActionsFor('ESCALATED', 'VENDOR')).toEqual([])
    expect(nextActionsFor('REJECTED', 'ADMIN')).toEqual([])
    expect(nextActionsFor('CLOSED', 'ADMIN')).toEqual([])
  })
})
