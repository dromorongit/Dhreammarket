import { describe, it, expect } from 'vitest'
import { applySecretRouting, secretExposureIntent } from './secret-routing'
import type { IntentResult, RedactionFinding, SensitiveKind } from '../types'

const finding = (kind: SensitiveKind): RedactionFinding => ({ kind, start: 0, end: 6 })

const baseIntent: IntentResult = {
  intent: 'unknown',
  confidence: 0,
  source: 'rules',
  policyDependent: false,
  needsApprovedContent: false,
  personalCase: false,
  signals: [],
}

describe('secretExposureIntent', () => {
  it('routes a card, a one-time code, a pin and a card security code to payment security', () => {
    for (const kind of ['card_number', 'otp', 'pin', 'cvv'] as SensitiveKind[]) {
      expect(secretExposureIntent([finding(kind)])).toBe('risk.payment_security')
    }
  })

  it('routes a password to account takeover', () => {
    expect(secretExposureIntent([finding('password')])).toBe('risk.account_takeover')
  })

  it('routes nothing when no secret was exposed', () => {
    expect(secretExposureIntent([])).toBeNull()
    expect(secretExposureIntent([finding('phone'), finding('email')])).toBeNull()
  })

  it('treats a password as the more serious exposure', () => {
    expect(secretExposureIntent([finding('card_number'), finding('password')])).toBe(
      'risk.account_takeover',
    )
  })
})

describe('applySecretRouting', () => {
  it('replaces the intent of a secret case', () => {
    const r = applySecretRouting(baseIntent, [finding('card_number')])
    expect(r.intent).toBe('risk.payment_security')
    expect(r.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('leaves the intent alone when no secret was exposed', () => {
    const r = applySecretRouting(baseIntent, [])
    expect(r).toBe(baseIntent)
  })

  it('keeps the original topic words in the signals', () => {
    const original: IntentResult = { ...baseIntent, intent: 'dispute.refund_request', signals: ['refund'] }
    const r = applySecretRouting(original, [finding('card_number')])
    expect(r.signals).toContain('refund')
    expect(r.signals.join(' ')).toContain('secret:card_number')
  })

  it('never leaves a clarification mode on a secret case', () => {
    const original: IntentResult = { ...baseIntent, clarifyMode: 'generic' }
    const r = applySecretRouting(original, [finding('otp')])
    expect(r.clarifyMode).toBeUndefined()
  })
})
