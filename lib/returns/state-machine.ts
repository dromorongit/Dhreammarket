import type { ReturnActor } from './types'

export type ReturnStatus =
  | 'PENDING'
  | 'ITEM_IN_TRANSIT'
  | 'ITEM_RECEIVED'
  | 'AWAITING_REFUND'
  | 'ESCALATED'
  | 'REJECTED'
  | 'CLOSED'

const TRANSITIONS: { from: ReturnStatus; to: ReturnStatus; actor: ReturnActor }[] = [
  { from: 'PENDING', to: 'AWAITING_REFUND', actor: 'VENDOR' },
  { from: 'PENDING', to: 'ESCALATED', actor: 'VENDOR' },
  { from: 'PENDING', to: 'ESCALATED', actor: 'SYSTEM' },
  { from: 'PENDING', to: 'ESCALATED', actor: 'ADMIN' },
  { from: 'ESCALATED', to: 'AWAITING_REFUND', actor: 'ADMIN' },
  { from: 'ESCALATED', to: 'REJECTED', actor: 'ADMIN' },
  { from: 'AWAITING_REFUND', to: 'CLOSED', actor: 'SYSTEM' },
  { from: 'AWAITING_REFUND', to: 'CLOSED', actor: 'ADMIN' },
]

export function canTransition(from: string, to: string, actor: string): boolean {
  return TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.actor === actor
  )
}

export function nextActionsFor(status: string, actor: string): string[] {
  return TRANSITIONS.filter((t) => t.from === status && t.actor === actor).map(
    (t) => t.to
  )
}

export const TRANSITION_TABLE = TRANSITIONS