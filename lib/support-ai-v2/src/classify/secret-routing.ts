/**
 * Secret exposure routing.
 *
 * When the REDACTOR finds a secret in the message, the case is a security
 * case, whatever else the message says. "I want a refund and my card is
 * 4242 4242 4242 4242" is still a refund request, but it is FIRST a card
 * number typed into the chat, so it is routed to the security queue and the
 * user is told not to share card details.
 *
 * The routing is:
 *
 *   - card number, one-time code, PIN or card security code -> risk.payment_security
 *   - password -> risk.account_takeover
 *
 * A password wins when several kinds are exposed, because a leaked password
 * is a full account compromise, not only a payment problem.
 *
 * The intent is replaced, but the ORIGINAL topic words are kept in the
 * signals, so the audit trail still shows what the message was about.
 * The redaction itself is unchanged: the ticket summary stays redacted and
 * the secret never leaves the sanitize stage.
 */

import type { IntentResult, RedactionFinding, SensitiveKind } from '../types'

/** Secret kinds that mean "someone can spend my money". */
const PAYMENT_SECRET_KINDS: ReadonlySet<SensitiveKind> = new Set([
  'card_number',
  'otp',
  'pin',
  'cvv',
])

/** Secret kinds that mean "someone can take over my account". */
const ACCOUNT_SECRET_KINDS: ReadonlySet<SensitiveKind> = new Set(['password'])

/**
 * The security intent for a set of redaction findings, or null when no secret
 * was exposed.
 */
export function secretExposureIntent(findings: RedactionFinding[]): IntentResult['intent'] | null {
  const kinds = new Set(findings.map((f) => f.kind))
  for (const kind of ACCOUNT_SECRET_KINDS) {
    if (kinds.has(kind)) return 'risk.account_takeover'
  }
  for (const kind of PAYMENT_SECRET_KINDS) {
    if (kinds.has(kind)) return 'risk.payment_security'
  }
  return null
}

/**
 * Replaces the intent of a case in which a secret was exposed with the
 * matching security intent.
 *
 * Pure: the same findings always give the same result.
 */
export function applySecretRouting(
  intent: IntentResult,
  findings: RedactionFinding[],
): IntentResult {
  const routed = secretExposureIntent(findings)
  if (!routed) return intent

  const kinds = [...new Set(findings.map((f) => f.kind))].sort()

  return {
    ...intent,
    intent: routed,
    // A secret in the chat is never something we are unsure about.
    confidence: Math.max(intent.confidence, 0.9),
    source: 'rules',
    policyDependent: false,
    needsApprovedContent: false,
    personalCase: true,
    // A secret is never clarified away.
    clarifyMode: undefined,
    // The original topic words are kept, so the audit trail still shows what
    // the message was about next to the reason it was routed to security.
    signals: [...intent.signals, `secret:${kinds.join('+')}`],
  }
}
