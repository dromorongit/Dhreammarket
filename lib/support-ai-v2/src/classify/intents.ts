/**
 * Intent taxonomy.
 *
 * A single typed record describing every intent the Phase 1 classifier can
 * emit. Richer metadata (defaultRisk, policyDependent, allowedRoles,
 * phase1Handling) drives risk assessment, scope checks and the decision.
 */

import type { Role, RiskLevel } from '../types'

export type AllowedRoles = 'all' | Role[]

export interface IntentDef {
  id: string
  defaultRisk: RiskLevel
  policyDependent: boolean
  allowedRoles: AllowedRoles
  phase1Handling: string
  // True when answering needs private per-user data we never touch in Phase 1.
  needsPrivateData?: boolean
  /**
   * True when the answer can only come from an approved document, so a missing
   * or conflicting document is a POLICY_GAP rather than a low-confidence
   * answer. Implied by policyDependent.
   */
  needsApprovedContent?: boolean
}

export const INTENTS: Record<string, IntentDef> = {
  'general.greeting': {
    id: 'general.greeting',
    defaultRisk: 'low',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'canned reply',
  },
  'general.about_platform': {
    id: 'general.about_platform',
    defaultRisk: 'low',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'answer from FAQ',
  },
  'buyer.how_to_order': {
    id: 'buyer.how_to_order',
    defaultRisk: 'low',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'answer from FAQ',
  },
  'buyer.payment_methods_info': {
    id: 'buyer.payment_methods_info',
    defaultRisk: 'medium',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'answer only if approved doc exists',
  },
  'buyer.delivery_info': {
    id: 'buyer.delivery_info',
    defaultRisk: 'medium',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'answer only if approved doc exists',
  },
  'buyer.returns_policy_info': {
    id: 'buyer.returns_policy_info',
    defaultRisk: 'medium',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'answer only if approved doc exists',
  },
  'buyer.order_status': {
    id: 'buyer.order_status',
    defaultRisk: 'medium',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'out of scope in Phase 1 (needs private data)',
    needsPrivateData: true,
  },
  'buyer.track_order_info': {
    id: 'buyer.track_order_info',
    defaultRisk: 'low',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'answer from FAQ (informational order tracking)',
  },
  'buyer.cancellation_info': {
    id: 'buyer.cancellation_info',
    defaultRisk: 'medium',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'answer only if approved doc exists (else POLICY_GAP)',
  },
  'vendor.onboarding_guide': {
    id: 'vendor.onboarding_guide',
    defaultRisk: 'low',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'answer from vendor guide',
  },
  'vendor.listing_guide': {
    id: 'vendor.listing_guide',
    defaultRisk: 'low',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'answer from vendor guide',
  },
  'vendor.store_management_guide': {
    id: 'vendor.store_management_guide',
    defaultRisk: 'low',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'answer from vendor guide',
  },
  'vendor.fees_plans_info': {
    id: 'vendor.fees_plans_info',
    defaultRisk: 'medium',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'answer only if approved doc exists',
  },
  'vendor.payout_info_general': {
    id: 'vendor.payout_info_general',
    defaultRisk: 'medium',
    policyDependent: true,
    allowedRoles: ['vendor', 'support_agent'],
    phase1Handling: 'answer only if approved doc exists',
  },
  'vendor.kyc_info_general': {
    id: 'vendor.kyc_info_general',
    defaultRisk: 'medium',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'answer only if approved doc exists',
  },
  'agent.procedure_lookup': {
    id: 'agent.procedure_lookup',
    defaultRisk: 'medium',
    policyDependent: true,
    allowedRoles: ['support_agent'],
    phase1Handling: 'support_agent only',
  },
  'account.help_general': {
    id: 'account.help_general',
    defaultRisk: 'medium',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'answer from FAQ',
    // The generic FAQ answers still need an approved document; without one the
    // case is a POLICY_GAP, not a low-confidence answer.
    needsApprovedContent: true,
  },
  'dispute.refund_request': {
    id: 'dispute.refund_request',
    defaultRisk: 'high',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'personal case - escalate',
  },
  'dispute.chargeback_or_payment': {
    id: 'dispute.chargeback_or_payment',
    defaultRisk: 'high',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'personal case - escalate',
  },
  'risk.fraud_report': {
    id: 'risk.fraud_report',
    defaultRisk: 'high',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'escalate (security)',
  },
  'risk.account_takeover': {
    id: 'risk.account_takeover',
    defaultRisk: 'high',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'escalate (security)',
  },
  'risk.payment_security': {
    id: 'risk.payment_security',
    defaultRisk: 'high',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'escalate (security)',
  },
  'vendor.payout_problem': {
    id: 'vendor.payout_problem',
    defaultRisk: 'high',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'personal case - escalate',
  },
  'vendor.kyc_failure': {
    id: 'vendor.kyc_failure',
    defaultRisk: 'high',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'personal case - escalate',
  },
  'account.suspension_reinstatement': {
    id: 'account.suspension_reinstatement',
    defaultRisk: 'high',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'personal case - escalate',
  },
  'legal.privacy_data_request': {
    id: 'legal.privacy_data_request',
    defaultRisk: 'high',
    policyDependent: true,
    allowedRoles: 'all',
    phase1Handling: 'personal case - escalate',
  },
  'security.prompt_injection': {
    id: 'security.prompt_injection',
    defaultRisk: 'high',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'refuse',
  },
  'security.unauthorized_access': {
    id: 'security.unauthorized_access',
    defaultRisk: 'high',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'refuse',
  },
  'abuse.harassment': {
    id: 'abuse.harassment',
    defaultRisk: 'medium',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'boundary reply, escalate if threatening',
  },
  'out_of_scope': {
    id: 'out_of_scope',
    defaultRisk: 'low',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'polite decline',
  },
  'unknown': {
    id: 'unknown',
    defaultRisk: 'medium',
    policyDependent: false,
    allowedRoles: 'all',
    phase1Handling: 'clarify, then escalate',
  },
}

/** High-risk intent set used by the risk engine (H1). */
export const HIGH_RISK_INTENT_IDS: ReadonlySet<string> = new Set(
  Object.values(INTENTS)
    .filter((d) => d.defaultRisk === 'high')
    .map((d) => d.id),
)

export function intentDef(id: string): IntentDef {
  const def = INTENTS[id]
  if (!def) {
    return INTENTS['unknown']
  }
  return def
}

/** Does the given role satisfy the intent's allowedRoles? */
export function roleAllowed(id: string, role: Role): boolean {
  const allowed = intentDef(id).allowedRoles
  if (allowed === 'all') return true
  return allowed.includes(role)
}
