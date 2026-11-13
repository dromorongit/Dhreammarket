import { describe, it, expect } from 'vitest'
import { validateInput, VALIDATION_REASONS, MAX_TEXT_LENGTH } from './validate-input'

const conv = 'c1'
const raw = (text: string) => ({ text, conversationId: conv })

describe('validateInput', () => {
  it('rejects empty', () => {
    const r = validateInput(raw(''))
    expect(r.valid).toBe(false)
    expect(r.reasonCode).toBe(VALIDATION_REASONS.EMPTY)
  })

  it('rejects whitespace-only', () => {
    const r = validateInput(raw('   \t  '))
    expect(r.valid).toBe(false)
    expect(r.reasonCode).toBe(VALIDATION_REASONS.EMPTY)
  })

  it('rejects too long', () => {
    const r = validateInput(raw('a'.repeat(MAX_TEXT_LENGTH + 1)))
    expect(r.valid).toBe(false)
    expect(r.reasonCode).toBe(VALIDATION_REASONS.TOO_LONG)
  })

  it('accepts exactly the boundary (2000)', () => {
    const r = validateInput(raw('a'.repeat(MAX_TEXT_LENGTH)))
    expect(r.valid).toBe(true)
    expect(r.normalized?.text.length).toBe(MAX_TEXT_LENGTH)
  })

  it('rejects non-string input', () => {
    expect(validateInput(123 as unknown).valid).toBe(false)
    expect(validateInput({ text: 123, conversationId: conv } as unknown).valid).toBe(false)
    expect(validateInput(null as unknown).valid).toBe(false)
  })

  it('strips control and zero-width characters in the normalized copy', () => {
    const r = validateInput(raw('a\u0000b\u200bc\u0007'))
    expect(r.valid).toBe(true)
    expect(r.normalized?.text).toBe('abc')
  })

  it('requires a non-empty conversationId', () => {
    expect(validateInput({ text: 'hi', conversationId: '' }).valid).toBe(false)
    expect(validateInput({ text: 'hi' } as unknown).valid).toBe(false)
  })

  it('uses server-side history, never client history', () => {
    const r = validateInput(
      { text: 'hi', conversationId: conv, history: [{ role: 'user', text: 'CLIENT-SHOULD-BE-IGNORED' }] },
      [{ role: 'agent', text: 'server-turn' }],
    )
    expect(r.valid).toBe(true)
    expect(r.normalized?.history.length).toBe(1)
    expect(r.normalized?.history[0].text).toBe('server-turn')
  })

  it('exposes hasUrl without stripping anything', () => {
    expect(validateInput(raw('check http://example.com now')).normalized?.hasUrl).toBe(true)
    expect(validateInput(raw('no link here')).normalized?.hasUrl).toBe(false)
    const withUrl = validateInput(raw('visit https://x.com'))
    expect(withUrl.normalized?.text).toContain('https://x.com')
  })

  it('populates the folded scan copy', () => {
    const r = validateInput(raw('IGNORE'))
    expect(r.normalized?.foldedText).toBe('ignore')
  })
})
