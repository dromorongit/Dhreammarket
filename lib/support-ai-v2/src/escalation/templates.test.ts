import { describe, it, expect } from 'vitest'
import { TEMPLATES, TEMPLATE_IDS, templateText } from './templates'

const TEXTS = Object.values(TEMPLATES)

// Forbidden PROMISE words (spec: never promise a refund, outcome or timeframe).
const PROMISE =
  /refunded|approved|will be paid|guaranteed|within\s+\d+\s+(business\s+)?days|you will receive|we have (refunded|approved|paid)|decision (has been|is) made/i

// Forbidden SECRET REQUEST phrasings (never ask for secrets).
const SECRET_REQUEST =
  /(please\s+)?(provide|send|enter|type|give me|what(?:'s| is) your)[^.]{0,24}(password|one[ -]?time|otp|\bpin\b|cvv|full card|card number)/i

describe('templates', () => {
  it('defines every required template id', () => {
    for (const id of [
      'ESCALATED_GENERIC',
      'ESCALATED_SECURITY',
      'ESCALATED_ACTION_REQUEST',
      'REFUSED_SECURITY',
      'REFUSED_OUT_OF_SCOPE',
      'CLARIFY_GENERIC',
      'CLARIFY_TOPIC',
      'BOUNDARY_ABUSE',
      'ORDER_STATUS_OUT_OF_SCOPE',
      'FAILED_SAFE',
    ]) {
      expect(TEMPLATE_IDS[id as keyof typeof TEMPLATE_IDS]).toBe(id)
      expect(TEMPLATES[id as keyof typeof TEMPLATES].length).toBeGreaterThan(0)
    }
  })

  it('no template text contains forbidden promise words', () => {
    for (const t of TEXTS) expect(PROMISE.test(t)).toBe(false)
  })

  it('no template text requests secrets', () => {
    for (const t of TEXTS) expect(SECRET_REQUEST.test(t)).toBe(false)
  })

  it('ESCALATED_SECURITY warns about secrets without requesting them', () => {
    expect(TEMPLATES.ESCALATED_SECURITY).toMatch(/never ask for your/i)
    expect(TEMPLATES.ESCALATED_SECURITY).not.toMatch(SECRET_REQUEST)
  })

  it('ESCALATED_ACTION_REQUEST says the assistant cannot act, and promises nothing', () => {
    expect(TEMPLATES.ESCALATED_ACTION_REQUEST).toMatch(/not able to make/i)
    expect(TEMPLATES.ESCALATED_ACTION_REQUEST).not.toMatch(PROMISE)
  })

  it('CLARIFY_TOPIC asks one question and warns about secrets', () => {
    expect(TEMPLATES.CLARIFY_TOPIC).toMatch(/\?/)
    expect(TEMPLATES.CLARIFY_TOPIC).toMatch(/general information/i)
    expect(TEMPLATES.CLARIFY_TOPIC).not.toMatch(SECRET_REQUEST)
  })

  it('BOUNDARY_ABUSE keeps the door open without agreeing with abuse', () => {
    expect(TEMPLATES.BOUNDARY_ABUSE).toMatch(/respectful/i)
    expect(TEMPLATES.BOUNDARY_ABUSE).not.toMatch(PROMISE)
  })

  it('templateText falls back to FAILED_SAFE for unknown ids', () => {
    expect(templateText('DOES_NOT_EXIST')).toBe(TEMPLATES.FAILED_SAFE)
  })
})
