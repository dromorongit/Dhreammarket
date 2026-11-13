/**
 * Input validation for the Support AI pipeline.
 *
 * History is never taken from the client — it is supplied by the caller
 * (the server) from already-verified session state.
 *
 * Phase 1 does not process attachments or links; we only expose a `hasUrl`
 * boolean and strip nothing.
 */

import { MAX_TEXT_LENGTH, normalize } from './normalize'
import type { RawInbound, NormalizedInbound, HistoryTurn } from '../types'

export { MAX_TEXT_LENGTH }

export interface ValidationResult {
  valid: boolean
  reasonCode?: string
  normalized?: NormalizedInbound
}

const REASON = {
  NOT_STRING: 'INVALID_INPUT_NOT_STRING',
  EMPTY: 'INVALID_INPUT_EMPTY',
  TOO_LONG: 'INVALID_INPUT_TOO_LONG',
  BAD_CONVERSATION_ID: 'INVALID_CONVERSATION_ID',
  BAD_HISTORY: 'INVALID_HISTORY',
} as const

// An empty RawInbound shape is available for callers that want a typed empty.
export function emptyRawInbound(): RawInbound {
  return { text: '', conversationId: '', history: [], attachments: [] }
}

export function validateInput(raw: unknown, serverHistory: HistoryTurn[] = []): ValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, reasonCode: REASON.NOT_STRING }
  }

  const r = raw as Record<string, unknown>

  if (typeof r.text !== 'string') {
    return { valid: false, reasonCode: REASON.NOT_STRING }
  }

  const trimmed = r.text.trim()

  if (trimmed.length === 0) {
    return { valid: false, reasonCode: REASON.EMPTY }
  }

  if (trimmed.length > MAX_TEXT_LENGTH) {
    return { valid: false, reasonCode: REASON.TOO_LONG }
  }

  if (typeof r.conversationId !== 'string' || r.conversationId.trim().length === 0) {
    return { valid: false, reasonCode: REASON.BAD_CONVERSATION_ID }
  }

  // History comes from the server, never the client.
  if (!Array.isArray(serverHistory)) {
    return { valid: false, reasonCode: REASON.BAD_HISTORY }
  }

  const history: HistoryTurn[] = []
  for (const turn of serverHistory) {
    if (typeof turn !== 'object' || turn === null) continue
    if (typeof turn.text !== 'string') continue
    history.push({
      role: turn.role === 'agent' ? 'agent' : 'user',
      text: turn.text,
      clarifyCount: typeof turn.clarifyCount === 'number' ? turn.clarifyCount : undefined,
    })
  }

  const { text, foldedText } = normalize(trimmed)
  const hasUrl = /https?:\/\//i.test(text)

  const normalized: NormalizedInbound = {
    text,
    foldedText,
    hasUrl,
    conversationId: r.conversationId.trim(),
    history,
    attachments: Array.isArray(r.attachments) ? r.attachments.filter((a): a is string => typeof a === 'string') : [],
  }

  return { valid: true, normalized }
}

export const VALIDATION_REASONS = REASON
