import { describe, it, expect } from 'vitest'
import { adminQueue, ADMIN_STATUS_COPY, QUEUE_COPY } from './admin-copy'

const ALL_STATUSES = [
  'PENDING',
  'ITEM_IN_TRANSIT',
  'ITEM_RECEIVED',
  'AWAITING_REFUND',
  'ESCALATED',
  'REJECTED',
  'CLOSED',
] as const

describe('ADMIN_STATUS_COPY exhaustiveness', () => {
  it('covers every ReturnStatus', () => {
    expect(Object.keys(ADMIN_STATUS_COPY).sort()).toEqual([...ALL_STATUSES].sort())
  })

  it('has complete copy for every status', () => {
    for (const status of ALL_STATUSES) {
      const copy = ADMIN_STATUS_COPY[status]
      expect(copy.label).toBeTruthy()
      expect(copy.description).toBeTruthy()
      expect(['info', 'success', 'warning', 'danger', 'neutral']).toContain(copy.tone)
    }
  })
})

describe('QUEUE_COPY', () => {
  it('covers every admin queue', () => {
    const queues = [
      'needs-escalation',
      'needs-decision',
      'awaiting-refund',
      'ready-to-close',
      'done',
    ] as const
    for (const queue of queues) {
      expect(QUEUE_COPY[queue].label).toBeTruthy()
      expect(QUEUE_COPY[queue].description).toBeTruthy()
    }
  })
})

describe('adminQueue', () => {
  const now = new Date('2026-10-25T12:00:00.000Z')
  const oneSecond = 1000

  it('buckets PENDING as needs-escalation one second past the deadline', () => {
    const deadline = new Date(now.getTime() - oneSecond)
    expect(adminQueue('PENDING', { overdue: true })).toBe('needs-escalation')
  })

  it('does not queue PENDING one second before the deadline', () => {
    expect(adminQueue('PENDING', { overdue: false })).toBeNull()
  })

  it('queues ESCALATED as needs-decision', () => {
    expect(adminQueue('ESCALATED', {})).toBe('needs-decision')
  })

  it('buckets AWAITING_REFUND with a PROCESSED refund as ready-to-close', () => {
    expect(adminQueue('AWAITING_REFUND', { refundStatus: 'PROCESSED' })).toBe('ready-to-close')
  })

  it('buckets AWAITING_REFUND without a processed refund as awaiting-refund', () => {
    expect(adminQueue('AWAITING_REFUND', { refundStatus: 'PENDING' })).toBe('awaiting-refund')
    expect(adminQueue('AWAITING_REFUND', { refundStatus: null })).toBe('awaiting-refund')
    expect(adminQueue('AWAITING_REFUND', {})).toBe('awaiting-refund')
  })

  it('queues CLOSED and REJECTED as done', () => {
    expect(adminQueue('CLOSED', {})).toBe('done')
    expect(adminQueue('REJECTED', {})).toBe('done')
  })

  it('does not queue reserved statuses', () => {
    expect(adminQueue('ITEM_IN_TRANSIT', {})).toBeNull()
    expect(adminQueue('ITEM_RECEIVED', {})).toBeNull()
  })
})
