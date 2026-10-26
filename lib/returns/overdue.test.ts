import { describe, it, expect } from 'vitest'
import { isOverdue, findOverdueReturns, findSettledReturns } from '@/lib/returns/overdue'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-25T12:00:00.000Z')

function req(overrides: any = {}) {
  return {
    id: 'rr_1',
    status: 'PENDING',
    escalationDeadline: new Date(NOW.getTime() - DAY),
    ...overrides,
  }
}

describe('isOverdue', () => {
  it('is true when past deadline and still awaiting vendor response', () => {
    expect(isOverdue(req(), NOW)).toBe(true)
    expect(isOverdue({ ...req(), status: 'ITEM_IN_TRANSIT' }, NOW)).toBe(true)
    expect(isOverdue({ ...req(), status: 'ITEM_RECEIVED' }, NOW)).toBe(true)
  })
  it('is false at the exact deadline boundary (now === deadline)', () => {
    const deadline = new Date(NOW.getTime())
    expect(isOverdue({ ...req(), escalationDeadline: deadline }, NOW)).toBe(false)
  })
  it('is false when not yet past the deadline', () => {
    expect(isOverdue({ ...req(), escalationDeadline: new Date(NOW.getTime() + DAY) }, NOW)).toBe(false)
  })
  it('is false once the request has been responded to', () => {
    for (const s of ['AWAITING_REFUND', 'ESCALATED', 'REJECTED', 'CLOSED']) {
      expect(isOverdue({ ...req(), status: s }, NOW)).toBe(false)
    }
  })
  it('is false when there is no deadline', () => {
    expect(isOverdue({ ...req(), escalationDeadline: null }, NOW)).toBe(false)
    expect(isOverdue({ ...req(), escalationDeadline: undefined }, NOW)).toBe(false)
  })
  it('is false for null or undefined request', () => {
    expect(isOverdue(null, NOW)).toBe(false)
    expect(isOverdue(undefined, NOW)).toBe(false)
  })
})

describe('findOverdueReturns', () => {
  it('returns only overdue pending requests', () => {
    const requests = [
      req({ id: 'rr_1', escalationDeadline: new Date(NOW.getTime() - DAY) }),
      req({ id: 'rr_2', escalationDeadline: new Date(NOW.getTime() + DAY) }),
      req({ id: 'rr_3', status: 'AWAITING_REFUND', escalationDeadline: new Date(NOW.getTime() - DAY) }),
    ]
    const overdue = findOverdueReturns(requests, NOW)
    expect(overdue.map((r: any) => r.id)).toEqual(['rr_1'])
  })
  it('excludes already-responded requests', () => {
    const requests = [
      req({ id: 'rr_1', status: 'ITEM_IN_TRANSIT', escalationDeadline: new Date(NOW.getTime() - DAY) }),
      req({ id: 'rr_2', status: 'AWAITING_REFUND', escalationDeadline: new Date(NOW.getTime() - DAY) }),
    ]
    expect(findOverdueReturns(requests, NOW).map((r: any) => r.id)).toEqual(['rr_1'])
  })
  it('accepts object input with a requests key', () => {
    const res = findOverdueReturns({ requests: [req()], now: NOW })
    expect(res.length).toBe(1)
  })
  it('returns empty for non-array input', () => {
    expect(findOverdueReturns(null as any, NOW)).toEqual([])
    expect(findOverdueReturns(undefined as any, NOW)).toEqual([])
  })
})

describe('findSettledReturns', () => {
  it('returns AWAITING_REFUND requests whose linked refund is PROCESSED', () => {
    const requests = [
      { id: 'rr_1', status: 'AWAITING_REFUND', refund: { status: 'PROCESSED' } },
      { id: 'rr_2', status: 'AWAITING_REFUND', refund: { status: 'PENDING' } },
      { id: 'rr_3', status: 'AWAITING_REFUND', refund: { status: 'FAILED' } },
      { id: 'rr_4', status: 'AWAITING_REFUND' },
      { id: 'rr_5', status: 'PENDING', refund: { status: 'PROCESSED' } },
      { id: 'rr_6', status: 'CLOSED', refund: { status: 'PROCESSED' } },
    ]
    const settled = findSettledReturns(requests)
    expect(settled.map((r: any) => r.id)).toEqual(['rr_1'])
  })

  it('supports refunds array form', () => {
    const requests = [
      { id: 'rr_1', status: 'AWAITING_REFUND', refunds: [{ status: 'PROCESSED' }] },
      { id: 'rr_2', status: 'AWAITING_REFUND', refunds: [{ status: 'PENDING' }] },
    ]
    const settled = findSettledReturns(requests)
    expect(settled.map((r: any) => r.id)).toEqual(['rr_1'])
  })

  it('returns empty for non-array input', () => {
    expect(findSettledReturns(null as any)).toEqual([])
    expect(findSettledReturns(undefined as any)).toEqual([])
  })

  it('accepts object input with a requests key', () => {
    const res = findSettledReturns({
      requests: [{ id: 'rr_1', status: 'AWAITING_REFUND', refund: { status: 'PROCESSED' } }],
    })
    expect(res.length).toBe(1)
  })
})
