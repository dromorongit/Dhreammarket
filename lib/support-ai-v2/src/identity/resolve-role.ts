/**
 * Role resolution.
 *
 * The role is derived ONLY from an already-verified session object supplied by
 * the caller. This function NEVER decodes tokens and NEVER reads role text
 * from the user's message.
 *
 * The role mapping is confirmed by the owner, Oct 13 2026: ADMIN and
 * SUPER_ADMIN are treated as `support_agent` (they are internal staff, not end
 * customers or vendors). If a distinct admin role is ever needed, add it to
 * `Role` in types.ts and update this map.
 */

import type { Role, Actor, Session } from '../types'

export type { Session }

// The single source of truth for the mapping. Keys are the verified session
// role strings; values are our internal roles.
export const ROLE_MAP: Record<string, Role> = {
  CUSTOMER: 'buyer',
  VENDOR: 'vendor',
  // Confirmed by owner, Oct 13 2026: internal staff roles map to support_agent.
  ADMIN: 'support_agent',
  SUPER_ADMIN: 'support_agent',
}

export function resolveRole(session: Session | null): Actor {
  if (!session || !session.authenticated) {
    return { role: 'visitor', authenticated: false, userId: undefined }
  }
  const role = session.role ? ROLE_MAP[session.role] : undefined
  if (!role) {
    // Authenticated but unrecognized role: fail closed to visitor.
    return { role: 'visitor', authenticated: true, userId: session.userId }
  }
  return { role, authenticated: true, userId: session.userId }
}
