/**
 * State machine for the Support AI pipeline.
 *
 * Pure transition table. Terminal states never transition.
 * Invalid transitions throw.
 *
 * Transition table (from the design spec):
 *   RECEIVED -> SANITIZED (input valid) | REFUSED (input invalid)
 *   SANITIZED -> ROLE_RESOLVED
 *   ROLE_RESOLVED -> REFUSED (security block) | CLASSIFIED
 *   CLASSIFIED -> SECURITY_CHECKED
 *   SECURITY_CHECKED -> SCOPE_CHECKED
 *   SCOPE_CHECKED -> RETRIEVED (in scope) | DECIDED (out of scope)
 *   RETRIEVED -> DECIDED
 *   DECIDED -> GENERATING | CLARIFYING | ESCALATED | REFUSED
 *   GENERATING -> VALIDATING
 *   VALIDATING -> ANSWERED | GENERATING (retry once) | ESCALATED
 *   any non-terminal -> FAILED_SAFE on error
 *
 * The "retry once" limit on VALIDATING -> GENERATING is enforced by the
 * orchestrator (tracking how many times it has regenerated), not here.
 * CLARIFYING is allowed at most twice per conversation; the orchestrator
 * enforces that limit using the history's clarifyCount, then escalates.
 */

export type State =
  | 'RECEIVED'
  | 'SANITIZED'
  | 'ROLE_RESOLVED'
  | 'CLASSIFIED'
  | 'SECURITY_CHECKED'
  | 'SCOPE_CHECKED'
  | 'RETRIEVED'
  | 'DECIDED'
  | 'GENERATING'
  | 'VALIDATING'
  | 'ANSWERED'
  | 'CLARIFYING'
  | 'ESCALATED'
  | 'REFUSED'
  | 'FAILED_SAFE'

export type Event =
  | 'input_valid'
  | 'input_invalid'
  | 'redacted'
  | 'security_block'
  | 'classified'
  | 'security_cleared'
  | 'scope_checked'
  | 'retrieved'
  | 'decided'
  | 'generate'
  | 'validated'
  | 'validation_failed'
  | 'answered'
  | 'clarified'
  | 'escalated'
  | 'refused'
  | 'error'

const TERMINAL_STATES: ReadonlySet<State> = new Set([
  'ANSWERED',
  'CLARIFYING',
  'ESCALATED',
  'REFUSED',
  'FAILED_SAFE',
])

const TRANSITIONS: Record<State, Partial<Record<Event, State>>> = {
  RECEIVED: {
    input_valid: 'SANITIZED',
    input_invalid: 'REFUSED',
    error: 'FAILED_SAFE',
  },
  SANITIZED: {
    redacted: 'ROLE_RESOLVED',
    error: 'FAILED_SAFE',
  },
  ROLE_RESOLVED: {
    security_block: 'REFUSED',
    classified: 'CLASSIFIED',
    error: 'FAILED_SAFE',
  },
  CLASSIFIED: {
    security_cleared: 'SECURITY_CHECKED',
    error: 'FAILED_SAFE',
  },
  SECURITY_CHECKED: {
    scope_checked: 'SCOPE_CHECKED',
    error: 'FAILED_SAFE',
  },
  SCOPE_CHECKED: {
    retrieved: 'RETRIEVED',
    decided: 'DECIDED',
    error: 'FAILED_SAFE',
  },
  RETRIEVED: {
    decided: 'DECIDED',
    error: 'FAILED_SAFE',
  },
  DECIDED: {
    generate: 'GENERATING',
    clarified: 'CLARIFYING',
    escalated: 'ESCALATED',
    refused: 'REFUSED',
    error: 'FAILED_SAFE',
  },
  GENERATING: {
    validated: 'VALIDATING',
    error: 'FAILED_SAFE',
  },
  VALIDATING: {
    answered: 'ANSWERED',
    validation_failed: 'GENERATING',
    escalated: 'ESCALATED',
    error: 'FAILED_SAFE',
  },
  ANSWERED: {},
  CLARIFYING: {},
  ESCALATED: {},
  REFUSED: {},
  FAILED_SAFE: {},
}

export function isTerminal(state: State): boolean {
  return TERMINAL_STATES.has(state)
}

export function transition(state: State, event: Event): State {
  if (isTerminal(state)) {
    throw new Error(`Cannot transition from terminal state ${state}`)
  }
  const next = TRANSITIONS[state]?.[event]
  if (!next) {
    throw new Error(`Invalid transition: ${state} --${event}-->`)
  }
  return next
}
