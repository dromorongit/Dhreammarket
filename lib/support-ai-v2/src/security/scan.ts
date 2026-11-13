/**
 * Security scan.
 *
 * Runs on the folded (lowercased, leet/lookalike-folded) copy so obfuscated
 * attacks are caught; base64-looking tokens are decoded once and rescanned.
 * It never sees or returns raw user text — only flags.
 *
 * Every pattern family lives in src/security/patterns.ts, which is the single
 * source of truth shared with the intent classifier and the risk keywords.
 *
 * The scan runs on three copies of the message:
 *   - the folded copy (lowercased, leet-folded);
 *   - the normalized copy (lowercased, otherwise untouched);
 *   - the typo-tolerant copy (the normalized copy with reviewed misspellings
 *     and fuzzy matches corrected), so "ignroe safety rules" is still caught.
 *
 * Instructions in RETRIEVED content are checked with `scanRetrievedText` so a
 * poisoned knowledge-base entry can be dropped in a later step.
 */

import type { SecurityFlags, SecurityFlagType, Actor } from '../types'
import { normalizeScanCopy } from '../sanitize/fuzzy'
import {
  ABUSE,
  ACTION_REQUEST,
  EXFILTRATION,
  PROMPT_INJECTION,
  ROLE_SPOOFING,
  THREAT,
  UNAUTHORIZED_ACCESS,
  anyMatch,
} from './patterns'

function tryDecodeBase64(token: string): string | null {
  try {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(token)) return null
    const decoded = atob(token)
    // Only accept mostly-printable ASCII to avoid noise.
    if (!/^[\x20-\x7E\r\t\n]+$/.test(decoded)) return null
    return decoded
  } catch {
    return null
  }
}

/** The copies of the message the patterns are matched against. */
function scanCopies(text: string, foldedText: string): { folded: string; plain: string; typo: string } {
  const plain = text.toLowerCase()
  return { folded: foldedText, plain, typo: normalizeScanCopy(plain) }
}

export function scan(text: string, foldedText: string, _actor: Actor): SecurityFlags {
  const copies = scanCopies(text, foldedText)
  const flags = new Set<SecurityFlagType>()
  let block = false

  // Prompt injection (on folded + plain + typo copy, plus base64 decode).
  let injection = anyMatch(PROMPT_INJECTION, copies.folded)
  if (!injection) injection = anyMatch(PROMPT_INJECTION, copies.plain)
  if (!injection) injection = anyMatch(PROMPT_INJECTION, copies.typo)
  if (!injection) {
    for (const token of text.match(/[A-Za-z0-9+/]{16,}={0,2}/g) ?? []) {
      const decoded = tryDecodeBase64(token)
      if (decoded && anyMatch(PROMPT_INJECTION, decoded.toLowerCase())) {
        injection = true
        break
      }
    }
  }
  if (injection) {
    flags.add('prompt_injection')
    block = true
  }

  // Unauthorized data access (the bulk-data verb family is typo tolerant).
  if (
    anyMatch(UNAUTHORIZED_ACCESS, copies.folded) ||
    anyMatch(UNAUTHORIZED_ACCESS, copies.plain) ||
    anyMatch(UNAUTHORIZED_ACCESS, copies.typo)
  ) {
    flags.add('unauthorized_access')
    block = true
  }

  // Exfiltration.
  if (
    anyMatch(EXFILTRATION, copies.folded) ||
    anyMatch(EXFILTRATION, copies.plain) ||
    anyMatch(EXFILTRATION, copies.typo)
  ) {
    flags.add('exfiltration')
    block = true
  }

  // Action requests. Flagged only: the module never performs them.
  const actionRequest =
    anyMatch(ACTION_REQUEST, copies.folded) ||
    anyMatch(ACTION_REQUEST, copies.plain) ||
    anyMatch(ACTION_REQUEST, copies.typo)
  if (actionRequest) flags.add('action_request')

  // Role spoofing — block when combined with a data or action request.
  const roleSpoof = anyMatch(ROLE_SPOOFING, copies.folded) || anyMatch(ROLE_SPOOFING, copies.plain)
  if (roleSpoof) {
    flags.add('role_spoofing')
    if (flags.has('unauthorized_access') || actionRequest) block = true
  }

  // Threats & abuse.
  if (anyMatch(THREAT, copies.folded) || anyMatch(THREAT, copies.plain)) flags.add('threat')
  if (anyMatch(ABUSE, copies.folded) || anyMatch(ABUSE, copies.plain)) flags.add('abuse')

  return { flags: [...flags], block }
}

/**
 * Scan retrieved knowledge-base text for instruction-like content so a
 * poisoned entry can be dropped by the retrieval layer in a later step.
 */
export function scanRetrievedText(chunkText: string): SecurityFlags {
  const folded = chunkText.toLowerCase()
  const flags = new Set<SecurityFlagType>()
  let block = false
  if (anyMatch(PROMPT_INJECTION, folded) || anyMatch(EXFILTRATION, folded)) {
    flags.add('prompt_injection')
    block = true
  }
  if (anyMatch(ACTION_REQUEST, folded)) flags.add('action_request')
  return { flags: [...flags], block }
}
