/**
 * Escalation planning (pure).
 *
 * Produces the tag, queue category, priority and template for an escalation.
 * NO ticket is created here — ticket creation belongs to a later step behind
 * EscalationPort.
 */

import type { Decision, IntentResult, RiskAssessment, Role, ReasonCode } from '../types'
import { TEMPLATE_IDS, TEMPLATES } from './templates'

export interface EscalationPlan {
  tag: string
  queueCategory: string
  priority: 'high' | 'normal'
  templateId: string
}

const FRAUD_INTENTS = new Set(['risk.fraud_report', 'risk.account_takeover', 'risk.payment_security'])
const SECURITY_INTENTS = new Set(['security.prompt_injection', 'security.unauthorized_access'])
const PAYOUT_INTENTS = new Set(['vendor.payout_problem', 'vendor.payout_info_general'])
const KYC_INTENTS = new Set(['vendor.kyc_failure', 'vendor.kyc_info_general'])

function tagFromReason(reason: ReasonCode): string {
  switch (reason) {
    case 'POLICY_GAP':
      return 'POLICY_GAP'
    case 'LOW_CONFIDENCE':
      return 'LOW_CONFIDENCE'
    case 'UNRESOLVED':
      return 'UNRESOLVED'
    case 'VALIDATION_FAILURE':
      return 'VALIDATION_FAILURE'
    case 'SYSTEM_ERROR':
      return 'SYSTEM_ERROR'
    case 'ABUSE':
      return 'ABUSE'
    case 'ACTION_REQUEST':
      return 'ACTION_REQUEST'
    default:
      // All high-risk reason codes collapse to HIGH_RISK.
      return 'HIGH_RISK'
  }
}

/**
 * The topic of an action request, taken from the risk reason detail.
 * The queue follows the topic, so a payout request reaches the payout queue
 * and a KYC request reaches the KYC queue.
 */
const ACTION_QUEUE_BY_TOPIC: Record<string, string> = {
  refund: 'payments_refunds',
  payment: 'payments_refunds',
  payout: 'vendor_payouts',
  kyc: 'kyc',
  suspension: 'account_trust',
  deletion: 'legal_privacy',
}

function actionQueueTopic(risk: RiskAssessment): string {
  const reason = risk.reasons.find((r) => r.code === 'ACTION_REQUEST')
  const topic = reason?.detail ?? ''
  return ACTION_QUEUE_BY_TOPIC[topic] ?? 'general'
}

function queueCategoryFor(intentId: string, tag: string, risk: RiskAssessment): string {
  if (tag === 'POLICY_GAP') return 'content_gap'
  if (tag === 'ABUSE') return 'abuse'
  if (tag === 'ACTION_REQUEST') return actionQueueTopic(risk)
  if (FRAUD_INTENTS.has(intentId) || SECURITY_INTENTS.has(intentId)) return 'fraud_security'
  if (intentId === 'dispute.refund_request' || intentId === 'dispute.chargeback_or_payment')
    return 'payments_refunds'
  if (PAYOUT_INTENTS.has(intentId)) return 'vendor_payouts'
  if (KYC_INTENTS.has(intentId)) return 'kyc'
  if (intentId === 'account.suspension_reinstatement') return 'account_trust'
  if (intentId === 'legal.privacy_data_request') return 'legal_privacy'
  return 'general'
}

export function buildEscalationPlan(
  decision: Decision,
  intent: IntentResult,
  risk: RiskAssessment,
  _role: Role,
): EscalationPlan {
  const tag = decision.escalationTag ?? tagFromReason(decision.reason)
  const queueCategory = queueCategoryFor(intent.intent, tag, risk)

  const hasThreat = risk.reasons.some(
    (r) => r.code === 'DISTRESS' || r.code === 'SECURITY_THREAT',
  )
  const highPriority =
    queueCategory === 'fraud_security' ||
    queueCategory === 'legal_privacy' ||
    hasThreat ||
    (tag === 'ABUSE' && hasThreat)

  const securityRelated =
    FRAUD_INTENTS.has(intent.intent) ||
    SECURITY_INTENTS.has(intent.intent) ||
    decision.reason === 'SECURITY_BLOCK'

  let templateId: string
  if (tag === 'ACTION_REQUEST') {
    templateId = TEMPLATE_IDS.ESCALATED_ACTION_REQUEST
  } else if (securityRelated) {
    templateId = TEMPLATE_IDS.ESCALATED_SECURITY
  } else {
    templateId = TEMPLATE_IDS.ESCALATED_GENERIC
  }

  return { tag, queueCategory, priority: highPriority ? 'high' : 'normal', templateId }
}

// Re-export for callers that just want the resolved text.
export { TEMPLATES }
