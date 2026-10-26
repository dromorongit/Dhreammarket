import { describe, it, expect } from 'vitest'
import { REASON_LABELS, REASON_ORDER, reasonLabel } from './reasons'
import type { ReturnReason } from './reasons'

const REASONS: ReturnReason[] = [
  'NOT_AS_DESCRIBED',
  'DAMAGED',
  'WRONG_ITEM',
  'NOT_RECEIVED',
  'CHANGE_OF_MIND',
  'OTHER',
]

describe('reasons', () => {
  it('has a label for every reason (exhaustive)', () => {
    for (const reason of REASONS) {
      const label = REASON_LABELS[reason]
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('REASON_ORDER lists every reason once', () => {
    expect([...REASON_ORDER].sort()).toEqual([...REASONS].sort())
  })

  it('maps known reasons', () => {
    expect(reasonLabel('DAMAGED')).toBe('Damaged or broken')
    expect(reasonLabel('NOT_AS_DESCRIBED')).toBe('Not as described')
    expect(reasonLabel('OTHER')).toBe('Other')
  })

  it('falls back to Other for unknown reasons', () => {
    expect(reasonLabel('NOT_A_REASON')).toBe('Other')
    expect(reasonLabel('')).toBe('Other')
  })
})
