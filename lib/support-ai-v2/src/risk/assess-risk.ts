/**
 * Risk assessment.
 *
 * Risk is MONOTONIC: it can only be raised while the pipeline runs.
 * `raiseRisk` and `raiseForRetrieval` are the only way to combine levels, and
 * they never lower a level. A classifier saying "low" can never override a
 * rule-assigned high.
 *
 * The reasons are ORDERED, not just sorted by severity: within one severity
 * the order below decides which reason is primary, and the primary reason
 * decides the escalation tag. The order is:
 *
 *   SECRET_EXPOSED, SECURITY_BLOCK, DISTRESS, ACTION_REQUEST, HIGH_RISK_INTENT,
 *   HIGH_KEYWORD, LOW_CONF_SENSITIVE, POLICY_GAP, then the medium reasons.
 *
 * A reason that is not in the list sorts last.
 */

import type {
  RiskLevel,
  RiskAssessment,
  RiskReason,
  IntentResult,
  SecurityFlags,
  Actor,
  RetrievalSummary,
  ReasonCode,
} from '../types'
import { HIGH_RISK_INTENT_IDS, intentDef, roleAllowed } from '../classify/intents'
import { normalizeTypoCopy } from '../sanitize/fuzzy'
import {
  HIGH_RISK_KEYWORDS,
  DISTRESS_PATTERNS,
  RULE_TOPIC_FAMILIES,
  actionRequestTopic,
  detectPersonalCase,
  detectInformational,
  matchedRuleFamily,
  sensitiveSignalGroup,
} from './keywords'

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 }

/**
 * The order in which reasons compete to be the primary one. Index 0 is the
 * most important. A reason that is not listed sorts after every listed one.
 */
const REASON_PRIORITY: ReasonCode[] = [
  'SECRET_EXPOSED',
  'SECURITY_BLOCK',
  'DISTRESS',
  'SECURITY_THREAT',
  'ACTION_REQUEST',
  'HIGH_RISK_INTENT',
  'HIGH_KEYWORD',
  'LOW_CONF_SENSITIVE',
  'POLICY_GAP',
  'POLICY_DEPENDENT',
  'PRIVATE_DATA_NEEDED',
  'ROLE_MISMATCH',
  'ABUSE',
  'FRAUD_OR_SCAM',
  'ACCOUNT_TAKEOVER',
  'UNAUTHORIZED_ACTIVITY',
  'FAKE_PARTY',
  'SUSPICIOUS_PAYMENT',
  'SHARED_SECRET',
  'CARD_MISUSE',
  'I_WAS_SCAMMED',
]

function priorityOf(code: ReasonCode): number {
  const i = REASON_PRIORITY.indexOf(code)
  return i === -1 ? REASON_PRIORITY.length : i
}

interface ReasonWithSeverity extends RiskReason {
  sev: RiskLevel
}

/** Raise-only merge: result is the higher of the two levels. */
export function raiseRisk(current: RiskLevel, next: RiskLevel): RiskLevel {
  return RANK[next] > RANK[current] ? next : current
}

/** Severity first, then the reason priority. */
function sortReasons(reasons: ReasonWithSeverity[]): ReasonWithSeverity[] {
  return [...reasons].sort(
    (a, b) => RANK[b.sev] - RANK[a.sev] || priorityOf(a.code) - priorityOf(b.code),
  )
}

/** The reason codes that are raised at HIGH severity. */
const HIGH_SEVERITY_CODES: ReadonlySet<ReasonCode> = new Set<ReasonCode>([
  'SECRET_EXPOSED',
  'SECURITY_BLOCK',
  'DISTRESS',
  'SECURITY_THREAT',
  'ACTION_REQUEST',
  'HIGH_RISK_INTENT',
  'HIGH_KEYWORD',
  'LOW_CONF_SENSITIVE',
  'FRAUD_OR_SCAM',
  'ACCOUNT_TAKEOVER',
  'UNAUTHORIZED_ACTIVITY',
  'FAKE_PARTY',
  'SUSPICIOUS_PAYMENT',
  'SHARED_SECRET',
  'CARD_MISUSE',
  'I_WAS_SCAMMED',
])

function severityOf(reason: RiskReason): RiskLevel {
  return HIGH_SEVERITY_CODES.has(reason.code) ? 'high' : 'medium'
}

export interface RiskInput {
  intent: IntentResult
  security: SecurityFlags
  secretExposed: boolean
  text: string
  actor: Actor
}

export function assessRisk(input: RiskInput): RiskAssessment {
  const reasons: ReasonWithSeverity[] = []
  let level: RiskLevel = 'low'
  const add = (sev: RiskLevel, code: ReasonCode, detail?: string): void => {
    reasons.push({ code, detail, sev })
    level = raiseRisk(level, sev)
  }

  const { intent, security, secretExposed, text, actor } = input

  // The rules run on the typo-tolerant copy, so "my payout don arrive" is
  // understood as well as the correctly spelt version. The original text is
  // never altered.
  const scan = normalizeTypoCopy(text)

  // H0 — the security scan blocked the message. A block is always high risk,
  // and the reason is carried into the decision and the audit event.
  if (security.block) {
    add('high', 'SECURITY_BLOCK')
  }

  // H1 — high-risk intent.
  if (HIGH_RISK_INTENT_IDS.has(intent.intent)) {
    add('high', 'HIGH_RISK_INTENT', intent.intent)
  }

  // H2a — fraud / security keywords (no exemption).
  for (const rule of HIGH_RISK_KEYWORDS) {
    if (rule.test.test(scan)) {
      add('high', rule.code, intent.intent)
    }
  }

  // H2b — topic family: personal -> high; informational -> medium; unclear ->
  // medium as well. An unclear topic is CLARIFIED (D1), not escalated, so it
  // must not be raised to high. A sensitive signal with an unknown intent is
  // escalated by H5 instead.
  const family = matchedRuleFamily(RULE_TOPIC_FAMILIES, scan)
  if (family) {
    if (detectPersonalCase(scan)) {
      add('high', 'HIGH_KEYWORD', family)
    } else {
      add('medium', 'POLICY_DEPENDENT', `${family}:${detectInformational(scan) ? 'info' : 'unclear'}`)
    }
  }

  // H3 — a secret was exposed in the message.
  if (secretExposed) {
    add('high', 'SECRET_EXPOSED')
  }

  // H4 — an action request. The module NEVER performs the action; it is
  // escalated to a human. Action requests are more specific than a generic
  // keyword hit, so they win the tag. The detail is the topic, which routes
  // the escalation to the right queue.
  if (security.flags.includes('action_request')) {
    add('high', 'ACTION_REQUEST', actionRequestTopic(scan))
  }

  // H5 — low classification confidence on a sensitive topic.
  if (intent.confidence < 0.5) {
    const group = sensitiveSignalGroup(scan)
    if (group) {
      add('high', 'LOW_CONF_SENSITIVE', group)
    }
  }

  // H6 — threats / self-harm / severe distress (conservative wordlist).
  for (const pat of DISTRESS_PATTERNS) {
    if (pat.test.test(scan)) {
      add('high', 'DISTRESS', pat.code)
    }
  }

  // Security-derived risk: threat is high, abuse alone is medium.
  if (security.flags.includes('threat')) {
    add('high', 'SECURITY_THREAT')
  }
  if (security.flags.includes('abuse') && RANK[level] < RANK.high) {
    add('medium', 'ABUSE')
  }

  // M rules (only raise to medium; cannot override an existing high).
  const def = intentDef(intent.intent)
  if (def.policyDependent && RANK[level] < RANK.high) {
    add('medium', 'POLICY_DEPENDENT', intent.intent)
  }
  if (def.needsPrivateData) {
    add('medium', 'PRIVATE_DATA_NEEDED', intent.intent)
  }
  if (def.allowedRoles !== 'all' && !roleAllowed(intent.intent, actor.role)) {
    add('medium', 'ROLE_MISMATCH', intent.intent)
  }

  const sorted = sortReasons(reasons)
  return {
    level,
    reasons: sorted.map((r) => ({ code: r.code, detail: r.detail })),
  }
}

/**
 * H4 — after retrieval, a policy-dependent intent with no usable chunks, any
 * conflicts, or any stale documents raises to high with POLICY_GAP.
 *
 * The new reason is inserted in the ORDER, not appended at the end, so the
 * primary reason (and therefore the escalation tag) stays correct.
 */
export function raiseForRetrieval(
  risk: RiskAssessment,
  intent: IntentResult,
  retrieval: RetrievalSummary,
): RiskAssessment {
  const def = intentDef(intent.intent)
  if (!def.policyDependent && !def.needsApprovedContent) return risk
  const gap =
    retrieval.usableChunkCount === 0 || retrieval.conflicts.length > 0 || retrieval.stale.length > 0
  if (!gap) return risk
  const withGap: ReasonWithSeverity[] = [
    ...risk.reasons.map((r) => ({ ...r, sev: severityOf(r) })),
    { code: 'POLICY_GAP', sev: 'high' },
  ]
  return {
    level: raiseRisk(risk.level, 'high'),
    reasons: sortReasons(withGap).map((r) => ({ code: r.code, detail: r.detail })),
  }
}
