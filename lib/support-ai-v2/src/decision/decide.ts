/**
 * Decision.
 *
 * Strict precedence (fail-closed):
 *   1. security block            -> REFUSE
 *   2. risk high                 -> ESCALATE (first risk reason)
 *   3. out of scope              -> REFUSE OUT_OF_SCOPE + right template
 *   4. policy gap (no chunks /
 *      conflicts / stale)        -> ESCALATE POLICY_GAP
 *   5. unknown intent            -> the unknown-intent rules, not thresholds
 *   6. confidence < escalateBelow -> ESCALATE LOW_CONFIDENCE
 *   7. confidence < answerAt      -> CLARIFY (or ESCALATE UNRESOLVED if
 *                                     clarifyCount already 2)
 *   8. otherwise                  -> ANSWER
 *
 * UNKNOWN INTENT (rule 5) never uses a threshold. An unknown intent with a
 * sensitive money / access / compromise signal is escalated, never answered and
 * never clarified. An unknown intent with no such signal gets ONE clarifying
 * question, and escalates as UNRESOLVED once two clarifications have been
 * asked.
 */

import type {
  Decision,
  SecurityFlags,
  RiskAssessment,
  IntentResult,
  RetrievalSummary,
  ConfidenceBreakdown,
  RiskReason,
} from '../types'
import type { ScopeResult } from '../scope/check-scope'
import { CONF } from './confidence'
import { TEMPLATE_IDS } from '../escalation/templates'

export interface DecideInput {
  security: SecurityFlags
  risk: RiskAssessment
  scope: ScopeResult
  intent: IntentResult
  retrieval: RetrievalSummary
  confidence: ConfidenceBreakdown
  clarifyCount: number
}

/** Signal groups that make an unknown intent a high-risk escalation. */
const HIGH_RISK_SIGNAL_GROUPS = new Set(['money', 'access', 'compromise', 'security'])

export function decide(input: DecideInput): Decision {
  const { security, risk, scope, intent, retrieval, confidence, clarifyCount } = input

  // 1. Security block -> REFUSE.
  if (security.block) {
    return { action: 'REFUSE', reason: 'SECURITY_BLOCK', templateId: TEMPLATE_IDS.REFUSED_SECURITY }
  }

  // 2. High risk -> ESCALATE with the first (highest-severity) risk reason.
  if (risk.level === 'high') {
    const reason = risk.reasons[0]
    return {
      action: 'ESCALATE',
      reason: reason?.code ?? 'HIGH_RISK',
      escalationTag: tagForRisk(reason),
    }
  }

  // 3. Out of scope -> REFUSE with the scope template.
  if (!scope.inScope) {
    return {
      action: 'REFUSE',
      reason: 'OUT_OF_SCOPE',
      templateId: scope.templateId ?? TEMPLATE_IDS.REFUSED_OUT_OF_SCOPE,
    }
  }

  // 4. The answer needs an approved document and there is no usable, current
  //    one -> POLICY_GAP. The content is missing, so the assistant must not
  //    answer from its own head.
  const needsApprovedContent = intent.policyDependent || intent.needsApprovedContent === true
  if (
    needsApprovedContent &&
    (retrieval.usableChunkCount === 0 ||
      retrieval.conflicts.length > 0 ||
      retrieval.stale.length > 0)
  ) {
    return { action: 'ESCALATE', reason: 'POLICY_GAP', escalationTag: 'POLICY_GAP' }
  }

  // 5. Unknown intent -> the unknown-intent rules, never a threshold.
  if (intent.intent === 'unknown') {
    // Two clarifications already asked and we still do not understand: hand
    // over to a human rather than loop.
    if (clarifyCount >= 2) {
      return { action: 'ESCALATE', reason: 'UNRESOLVED', escalationTag: 'UNRESOLVED' }
    }
    // A sensitive signal with an unknown intent is escalated, never answered
    // and never clarified.
    const sensitive = risk.reasons.find((r) => r.code === 'LOW_CONF_SENSITIVE')
    if (sensitive) {
      return {
        action: 'ESCALATE',
        reason: 'LOW_CONFIDENCE',
        escalationTag: tagForSensitiveSignal(sensitive),
      }
    }
    return {
      action: 'CLARIFY',
      reason: 'CLARIFY',
      templateId:
        intent.clarifyMode === 'topic' ? TEMPLATE_IDS.CLARIFY_TOPIC : TEMPLATE_IDS.CLARIFY_GENERIC,
    }
  }

  // 5b. Mild abuse without a threat -> a boundary reply, not an answer and
  //     not an escalation. A message that also contained a recognised
  //     answerable intent was already classified by that intent, so the tone
  //     is ignored there.
  if (intent.intent === 'abuse.harassment') {
    return { action: 'REFUSE', reason: 'ABUSE', templateId: TEMPLATE_IDS.BOUNDARY_ABUSE }
  }

  // 5c. A message we understand but that is too vague -> one clarifying
  //     question. A bare topic word ("refund", "my account") gets the topic
  //     question, anything else the generic one.
  if (intent.clarifyMode) {
    if (clarifyCount >= 2) {
      return { action: 'ESCALATE', reason: 'UNRESOLVED', escalationTag: 'UNRESOLVED' }
    }
    return {
      action: 'CLARIFY',
      reason: 'CLARIFY',
      templateId:
        intent.clarifyMode === 'topic' ? TEMPLATE_IDS.CLARIFY_TOPIC : TEMPLATE_IDS.CLARIFY_GENERIC,
    }
  }

  // 6. Confidence below the escalation floor. The clarify limit wins: when we
  //    have already asked twice, the case is UNRESOLVED, not low confidence.
  if (confidence.score < CONF.escalateBelow) {
    if (clarifyCount >= 2) {
      return { action: 'ESCALATE', reason: 'UNRESOLVED', escalationTag: 'UNRESOLVED' }
    }
    return { action: 'ESCALATE', reason: 'LOW_CONFIDENCE', escalationTag: 'LOW_CONFIDENCE' }
  }

  // 7. Confidence below the answer threshold -> CLARIFY, unless we have
  //    already clarified twice, in which case escalate UNRESOLVED.
  if (confidence.score < CONF.answerAt) {
    if (clarifyCount >= 2) {
      return { action: 'ESCALATE', reason: 'UNRESOLVED', escalationTag: 'UNRESOLVED' }
    }
    return { action: 'CLARIFY', reason: 'CLARIFY', templateId: TEMPLATE_IDS.CLARIFY_GENERIC }
  }

  // 8. Answer.
  return { action: 'ANSWER', reason: 'ANSWERED' }
}

/**
 * A sensitive signal escalates as HIGH_RISK when it is money, access loss or
 * a compromise. Anything else sensitive is only LOW_CONFIDENCE.
 */
function tagForSensitiveSignal(reason: RiskReason): string {
  const group = reason.detail ?? ''
  return HIGH_RISK_SIGNAL_GROUPS.has(group) ? 'HIGH_RISK' : 'LOW_CONFIDENCE'
}

function tagForRisk(reason: RiskReason | undefined): string {
  switch (reason?.code) {
    case 'POLICY_GAP':
      return 'POLICY_GAP'
    case 'ACTION_REQUEST':
      return 'ACTION_REQUEST'
    case 'LOW_CONF_SENSITIVE':
      return tagForSensitiveSignal(reason)
    case 'DISTRESS':
    case 'SECURITY_THREAT':
      // An explicit threat is escalated with the abuse tag and the highest
      // priority, so it reaches a human immediately.
      return 'ABUSE'
    case 'ABUSE':
      return 'ABUSE'
    default:
      return 'HIGH_RISK'
  }
}
