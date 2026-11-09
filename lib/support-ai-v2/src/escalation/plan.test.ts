import { describe, it, expect } from 'vitest'
import { buildEscalationPlan } from './plan'
import { TEMPLATE_IDS } from './templates'
import type { Decision, IntentResult, RiskAssessment, Role } from '../types'

const mkIntent = (intent: IntentResult['intent']): IntentResult => ({
  intent,
  confidence: 0.8,
  source: 'rules',
  policyDependent: false,
  personalCase: false,
  signals: [],
})

const risk = (level: RiskAssessment['level'], reasons: RiskAssessment['reasons'] = []): RiskAssessment => ({
  level,
  reasons,
})

const buyer: Role = 'buyer'
const esc = (over?: Partial<Decision>): Decision => ({ action: 'ESCALATE', reason: 'HIGH_RISK', ...over })

describe('buildEscalationPlan', () => {
  it('routes fraud to fraud_security with high priority and the security template', () => {
    const p = buildEscalationPlan(esc(), mkIntent('risk.fraud_report'), risk('high'), buyer)
    expect(p.tag).toBe('HIGH_RISK')
    expect(p.queueCategory).toBe('fraud_security')
    expect(p.priority).toBe('high')
    expect(p.templateId).toBe(TEMPLATE_IDS.ESCALATED_SECURITY)
  })

  it('routes refunds to payments_refunds (normal priority)', () => {
    const p = buildEscalationPlan(esc(), mkIntent('dispute.refund_request'), risk('high'), buyer)
    expect(p.queueCategory).toBe('payments_refunds')
    expect(p.priority).toBe('normal')
    expect(p.templateId).toBe(TEMPLATE_IDS.ESCALATED_GENERIC)
  })

  it('routes legal to legal_privacy with high priority', () => {
    const p = buildEscalationPlan(esc(), mkIntent('legal.privacy_data_request'), risk('high'), buyer)
    expect(p.queueCategory).toBe('legal_privacy')
    expect(p.priority).toBe('high')
  })

  it('routes a policy gap to content_gap', () => {
    const p = buildEscalationPlan(
      esc({ reason: 'POLICY_GAP', escalationTag: 'POLICY_GAP' }),
      mkIntent('buyer.returns_policy_info'),
      risk('high'),
      buyer,
    )
    expect(p.tag).toBe('POLICY_GAP')
    expect(p.queueCategory).toBe('content_gap')
  })

  it('elevates priority for distress/threat reasons', () => {
    const p = buildEscalationPlan(
      esc(),
      mkIntent('account.suspension_reinstatement'),
      risk('high', [{ code: 'DISTRESS' }]),
      buyer,
    )
    expect(p.priority).toBe('high')
  })
})

describe('buildEscalationPlan: action requests', () => {
  const action = (topic: string): Decision => ({
    action: 'ESCALATE',
    reason: 'ACTION_REQUEST',
    escalationTag: 'ACTION_REQUEST',
  })

  it('routes an action request by topic', () => {
    const cases: [string, string][] = [
      ['refund', 'payments_refunds'],
      ['payout', 'vendor_payouts'],
      ['kyc', 'kyc'],
      ['suspension', 'account_trust'],
      ['deletion', 'legal_privacy'],
      ['general', 'general'],
    ]
    for (const [topic, queue] of cases) {
      const p = buildEscalationPlan(
        action(topic),
        mkIntent('unknown'),
        risk('high', [{ code: 'ACTION_REQUEST', detail: topic }]),
        buyer,
      )
      expect(p.tag, topic).toBe('ACTION_REQUEST')
      expect(p.queueCategory, topic).toBe(queue)
      expect(p.templateId, topic).toBe(TEMPLATE_IDS.ESCALATED_ACTION_REQUEST)
    }
  })

  it('never claims that the action was performed', () => {
    const p = buildEscalationPlan(
      action('refund'),
      mkIntent('unknown'),
      risk('high', [{ code: 'ACTION_REQUEST', detail: 'refund' }]),
      buyer,
    )
    expect(p.templateId).toBe(TEMPLATE_IDS.ESCALATED_ACTION_REQUEST)
  })
})
