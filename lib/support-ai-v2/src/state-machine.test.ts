import { describe, it, expect } from 'vitest'
import { transition, isTerminal, type State, type Event } from './state-machine'

const LEGAL: Array<[State, Event]> = [
  ['RECEIVED', 'input_valid'],
  ['RECEIVED', 'input_invalid'],
  ['SANITIZED', 'redacted'],
  ['ROLE_RESOLVED', 'security_block'],
  ['ROLE_RESOLVED', 'classified'],
  ['CLASSIFIED', 'security_cleared'],
  ['SECURITY_CHECKED', 'scope_checked'],
  ['SCOPE_CHECKED', 'retrieved'],
  ['SCOPE_CHECKED', 'decided'],
  ['RETRIEVED', 'decided'],
  ['DECIDED', 'generate'],
  ['DECIDED', 'clarified'],
  ['DECIDED', 'escalated'],
  ['DECIDED', 'refused'],
  ['GENERATING', 'validated'],
  ['VALIDATING', 'answered'],
  ['VALIDATING', 'validation_failed'],
  ['VALIDATING', 'escalated'],
]

const TERMINAL: State[] = ['ANSWERED', 'CLARIFYING', 'ESCALATED', 'REFUSED', 'FAILED_SAFE']
const NON_TERMINAL: State[] = [
  'RECEIVED',
  'SANITIZED',
  'ROLE_RESOLVED',
  'CLASSIFIED',
  'SECURITY_CHECKED',
  'SCOPE_CHECKED',
  'RETRIEVED',
  'DECIDED',
  'GENERATING',
  'VALIDATING',
]

describe('state-machine', () => {
  it('every legal transition in the table works', () => {
    for (const [s, e] of LEGAL) {
      expect(() => transition(s, e)).not.toThrow()
    }
  })

  it('terminal states are terminal', () => {
    for (const s of TERMINAL) expect(isTerminal(s)).toBe(true)
  })

  it('terminal states never transition', () => {
    for (const s of TERMINAL) {
      for (const [, e] of LEGAL) expect(() => transition(s, e)).toThrow()
      expect(() => transition(s, 'error')).toThrow()
    }
  })

  it('invalid transitions throw', () => {
    expect(() => transition('RECEIVED', 'answered')).toThrow()
    expect(() => transition('DECIDED', 'answered')).toThrow()
    expect(() => transition('ANSWERED', 'error')).toThrow()
  })

  it('FAILED_SAFE is reachable from every non-terminal state', () => {
    for (const s of NON_TERMINAL) {
      expect(transition(s, 'error')).toBe('FAILED_SAFE')
    }
  })

  it('the once-only retry edge is VALIDATING -> GENERATING', () => {
    expect(transition('VALIDATING', 'validation_failed')).toBe('GENERATING')
  })
})
