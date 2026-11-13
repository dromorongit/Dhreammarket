import { describe, it, expect } from 'vitest'
import { decide, type DecideInput } from './decide'
import type {
  IntentResult,
  RiskAssessment,
  SecurityFlags,
  RetrievalSummary,
  ConfidenceBreakdown,
} from '../types'

const intent = (over?: Partial<IntentResult>): IntentResult => ({
  intent: 'buyer.returns_policy_info',
  confidence: 0.85,
  source: 'rules',
  policyDependent: true,
  personalCase: false,
  signals: [],
  ...over,
})

const retrieval = (over?: Partial<RetrievalSummary>): RetrievalSummary => ({
  usableChunkCount: 2,
  coverage: 0.9,
  topChunkScore: 0.8,
  conflicts: [],
  stale: [],
  ...over,
})

const conf = (score: number): ConfidenceBreakdown => ({ intent: 0.85, retrieval: 0.8, roleFit: 1, score })

const clean: SecurityFlags = { flags: [], block: false }
const scopeIn = { inScope: true }
const scopeOOS = { inScope: false, reason: 'OUT_OF_SCOPE', templateId: 'ORDER_STATUS_OUT_OF_SCOPE' }
const riskLow: RiskAssessment = { level: 'low', reasons: [] }
const riskHigh: RiskAssessment = {
  level: 'high',
  reasons: [{ code: 'HIGH_RISK_INTENT' }, { code: 'HIGH_KEYWORD' }],
}

const base: DecideInput = {
  security: clean,
  risk: riskLow,
  scope: scopeIn,
  intent: intent(),
  retrieval: retrieval(),
  confidence: conf(0.9),
  clarifyCount: 0,
}

describe('decide precedence', () => {
  it('security block wins over everything -> REFUSE', () => {
    const d = decide({
      ...base,
      security: { flags: ['prompt_injection'], block: true },
      risk: riskHigh,
      scope: scopeOOS,
      confidence: conf(0.1),
    })
    expect(d.action).toBe('REFUSE')
    expect(d.reason).toBe('SECURITY_BLOCK')
    expect(d.templateId).toBe('REFUSED_SECURITY')
  })

  it('high risk escalates with the first risk reason even with high confidence', () => {
    const d = decide({ ...base, risk: riskHigh, confidence: conf(0.99) })
    expect(d.action).toBe('ESCALATE')
    expect(d.reason).toBe('HIGH_RISK_INTENT')
    expect(d.escalationTag).toBe('HIGH_RISK')
  })

  it('out of scope -> REFUSE with the scope template', () => {
    const d = decide({ ...base, scope: scopeOOS })
    expect(d.action).toBe('REFUSE')
    expect(d.reason).toBe('OUT_OF_SCOPE')
    expect(d.templateId).toBe('ORDER_STATUS_OUT_OF_SCOPE')
  })

  it('policy-dependent intent with no usable chunks -> POLICY_GAP', () => {
    const d = decide({ ...base, retrieval: retrieval({ usableChunkCount: 0 }) })
    expect(d.action).toBe('ESCALATE')
    expect(d.reason).toBe('POLICY_GAP')
  })

  it('policy-dependent intent with conflicts -> POLICY_GAP', () => {
    const d = decide({ ...base, retrieval: retrieval({ conflicts: ['a vs b'] }) })
    expect(d.reason).toBe('POLICY_GAP')
  })

  it('confidence below the escalation floor -> LOW_CONFIDENCE', () => {
    expect(decide({ ...base, confidence: conf(0.49) }).reason).toBe('LOW_CONFIDENCE')
  })

  it('confidence exactly at 0.5 clarifies (not escalate)', () => {
    const d = decide({ ...base, confidence: conf(0.5) })
    expect(d.action).toBe('CLARIFY')
  })

  it('confidence in (0.5, 0.75) clarifies', () => {
    expect(decide({ ...base, confidence: conf(0.6) }).action).toBe('CLARIFY')
  })

  it('confidence exactly at 0.75 answers', () => {
    expect(decide({ ...base, confidence: conf(0.75) }).action).toBe('ANSWER')
  })

  it('two clarifications already -> escalate UNRESOLVED instead of clarifying', () => {
    const d = decide({ ...base, confidence: conf(0.6), clarifyCount: 2 })
    expect(d.action).toBe('ESCALATE')
    expect(d.reason).toBe('UNRESOLVED')
  })

  it('role mismatch (roleFit 0, score 0) with in-scope -> low confidence escalate', () => {
    const d = decide({ ...base, confidence: conf(0) })
    expect(d.action).toBe('ESCALATE')
    expect(d.reason).toBe('LOW_CONFIDENCE')
  })
})

describe('decide: unknown intent never uses a threshold', () => {
  const unknown = intent({ intent: 'unknown', confidence: 0, policyDependent: false })

  it('an unknown intent with no signal asks one clarifying question', () => {
    const d = decide({ ...base, intent: unknown, risk: riskLow, confidence: conf(0.2) })
    expect(d.action).toBe('CLARIFY')
    expect(d.reason).toBe('CLARIFY')
    expect(d.templateId).toBe('CLARIFY_GENERIC')
  })

  it('an unknown intent with a money signal is escalated, never answered or clarified', () => {
    const d = decide({
      ...base,
      intent: unknown,
      risk: { level: 'high', reasons: [{ code: 'LOW_CONF_SENSITIVE', detail: 'money' }] },
      confidence: conf(0.9),
    })
    expect(d.action).toBe('ESCALATE')
    expect(d.escalationTag).toBe('HIGH_RISK')
  })

  it('an unknown intent with an access-loss or compromise signal escalates as HIGH_RISK', () => {
    for (const group of ['money', 'access', 'compromise', 'security']) {
      const d = decide({
        ...base,
        intent: unknown,
        risk: { level: 'high', reasons: [{ code: 'LOW_CONF_SENSITIVE', detail: group }] },
      })
      expect(d.escalationTag, group).toBe('HIGH_RISK')
    }
  })

  it('an unknown intent with another sensitive signal escalates as LOW_CONFIDENCE', () => {
    const d = decide({
      ...base,
      intent: unknown,
      risk: { level: 'high', reasons: [{ code: 'LOW_CONF_SENSITIVE', detail: 'other' }] },
    })
    expect(d.action).toBe('ESCALATE')
    expect(d.escalationTag).toBe('LOW_CONFIDENCE')
  })

  it('two clarifications on an unknown intent escalate UNRESOLVED', () => {
    const d = decide({ ...base, intent: unknown, risk: riskLow, confidence: conf(0.2), clarifyCount: 2 })
    expect(d.action).toBe('ESCALATE')
    expect(d.reason).toBe('UNRESOLVED')
    expect(d.escalationTag).toBe('UNRESOLVED')
  })

  it('an unknown intent with a high score still cannot be answered', () => {
    const d = decide({ ...base, intent: unknown, risk: riskLow, confidence: conf(0.99) })
    expect(d.action).not.toBe('ANSWER')
  })
})

describe('decide: action requests', () => {
  it('an action request escalates with the ACTION_REQUEST tag', () => {
    const d = decide({
      ...base,
      risk: {
        level: 'high',
        reasons: [
          { code: 'ACTION_REQUEST', detail: 'payout' },
          { code: 'HIGH_KEYWORD', detail: 'PAYOUT' },
        ],
      },
    })
    expect(d.action).toBe('ESCALATE')
    expect(d.reason).toBe('ACTION_REQUEST')
    expect(d.escalationTag).toBe('ACTION_REQUEST')
  })
})

describe('decide: clarifying a vague message', () => {
  it('a bare topic word gets the topic question', () => {
    const d = decide({
      ...base,
      intent: intent({ intent: 'buyer.returns_policy_info', clarifyMode: 'topic' }),
      confidence: conf(0.8),
    })
    expect(d.action).toBe('CLARIFY')
    expect(d.templateId).toBe('CLARIFY_TOPIC')
  })

  it('a message we cannot place gets the generic question', () => {
    const d = decide({
      ...base,
      intent: intent({ intent: 'buyer.returns_policy_info', clarifyMode: 'generic' }),
      confidence: conf(0.8),
    })
    expect(d.action).toBe('CLARIFY')
    expect(d.templateId).toBe('CLARIFY_GENERIC')
  })

  it('two clarifications on a vague message escalate UNRESOLVED', () => {
    const d = decide({
      ...base,
      intent: intent({ intent: 'buyer.returns_policy_info', clarifyMode: 'topic' }),
      confidence: conf(0.8),
      clarifyCount: 2,
    })
    expect(d.action).toBe('ESCALATE')
    expect(d.reason).toBe('UNRESOLVED')
  })
})

describe('decide: abuse', () => {
  it('mild abuse gets a boundary reply, not an answer and not an escalation', () => {
    const d = decide({
      ...base,
      intent: intent({ intent: 'abuse.harassment', confidence: 0.3 }),
      risk: { level: 'medium', reasons: [{ code: 'ABUSE' }] },
      confidence: conf(0.3),
    })
    expect(d.action).toBe('REFUSE')
    expect(d.reason).toBe('ABUSE')
    expect(d.templateId).toBe('BOUNDARY_ABUSE')
  })

  it('an explicit threat escalates with the abuse tag', () => {
    const d = decide({
      ...base,
      intent: intent({ intent: 'unknown', confidence: 0 }),
      risk: { level: 'high', reasons: [{ code: 'DISTRESS', detail: 'THREAT_OF_HARM' }] },
    })
    expect(d.action).toBe('ESCALATE')
    expect(d.escalationTag).toBe('ABUSE')
  })
})
