import { describe, it, expect } from 'vitest'
import { checkScope } from './check-scope'
import type { IntentResult } from '../types'

const mk = (intent: IntentResult['intent']): IntentResult => ({
  intent,
  confidence: 0.8,
  source: 'rules',
  policyDependent: false,
  personalCase: false,
  signals: [],
})

const buyer = { role: 'buyer' as const, authenticated: true }
const visitor = { role: 'visitor' as const, authenticated: false }
const agent = { role: 'support_agent' as const, authenticated: true }

describe('checkScope', () => {
  it('order status is out of scope with its own template', () => {
    const s = checkScope(mk('buyer.order_status'), buyer)
    expect(s.inScope).toBe(false)
    expect(s.templateId).toBe('ORDER_STATUS_OUT_OF_SCOPE')
    expect(s.orderStatusOutOfScope).toBe(true)
  })

  it('security intents are never in scope', () => {
    expect(checkScope(mk('security.prompt_injection'), buyer).templateId).toBe('REFUSED_SECURITY')
    expect(checkScope(mk('security.unauthorized_access'), buyer).templateId).toBe('REFUSED_SECURITY')
  })

  it('general out_of_scope intent is declined', () => {
    const s = checkScope(mk('out_of_scope'), buyer)
    expect(s.inScope).toBe(false)
    expect(s.templateId).toBe('REFUSED_OUT_OF_SCOPE')
  })

  it('support_agent-only intent is out of scope for other roles (role mismatch)', () => {
    const s = checkScope(mk('agent.procedure_lookup'), visitor)
    expect(s.inScope).toBe(false)
    expect(s.reason).toBe('ROLE_MISMATCH')
    // but in scope for an agent
    expect(checkScope(mk('agent.procedure_lookup'), agent).inScope).toBe(true)
  })

  it('answerable intents are in scope', () => {
    expect(checkScope(mk('buyer.returns_policy_info'), buyer).inScope).toBe(true)
    expect(checkScope(mk('general.about_platform'), visitor).inScope).toBe(true)
  })

  it('the new informational intents are in scope', () => {
    expect(checkScope(mk('buyer.track_order_info'), buyer).inScope).toBe(true)
    expect(checkScope(mk('buyer.cancellation_info'), buyer).inScope).toBe(true)
    expect(checkScope(mk('vendor.store_management_guide'), buyer).inScope).toBe(true)
  })

  it('the vendor payout guide is not in scope for a buyer', () => {
    const s = checkScope(mk('vendor.payout_info_general'), buyer)
    expect(s.inScope).toBe(false)
    expect(s.reason).toBe('ROLE_MISMATCH')
    expect(checkScope(mk('vendor.payout_info_general'), { role: 'vendor', authenticated: true }).inScope).toBe(
      true,
    )
  })
})
