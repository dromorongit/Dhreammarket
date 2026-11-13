/**
 * Scope check.
 *
 * Determines whether an intent is answerable for the given actor in Phase 1.
 * Out-of-scope intents (private-data lookups, security intents, role-mismatched
 * intents, and general out-of-scope) never reach retrieval/generation.
 */

import type { IntentResult, Actor } from '../types'
import { intentDef, roleAllowed } from '../classify/intents'

export interface ScopeResult {
  inScope: boolean
  reason?: string
  templateId?: string
  orderStatusOutOfScope?: boolean
}

const SECURITY_INTENTS = new Set(['security.prompt_injection', 'security.unauthorized_access'])

export function checkScope(intent: IntentResult, actor: Actor): ScopeResult {
  const id = intent.intent

  // Security intents are refused, never answered.
  if (SECURITY_INTENTS.has(id)) {
    return { inScope: false, reason: 'SECURITY', templateId: 'REFUSED_SECURITY' }
  }

  // Order status needs private per-user data -> out of scope in Phase 1.
  if (id === 'buyer.order_status') {
    return {
      inScope: false,
      reason: 'OUT_OF_SCOPE',
      templateId: 'ORDER_STATUS_OUT_OF_SCOPE',
      orderStatusOutOfScope: true,
    }
  }

  // General out-of-scope intent.
  if (id === 'out_of_scope') {
    return { inScope: false, reason: 'OUT_OF_SCOPE', templateId: 'REFUSED_OUT_OF_SCOPE' }
  }

  // Role mismatch (e.g. a visitor asking agent-only content).
  const def = intentDef(id)
  if (def.allowedRoles !== 'all' && !roleAllowed(id, actor.role)) {
    return { inScope: false, reason: 'ROLE_MISMATCH', templateId: 'REFUSED_OUT_OF_SCOPE' }
  }

  return { inScope: true }
}
