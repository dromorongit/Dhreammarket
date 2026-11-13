import { describe, it, expect } from 'vitest'
import { redact, redactForLog, PLACEHOLDERS } from './redact'

const kindsOf = (text: string) => redact(text).findings.map((f) => f.kind)

describe('redact', () => {
  it('redacts a Luhn-valid card', () => {
    const r = redact('my card is 4242 4242 4242 4242 thanks')
    expect(r.findings.some((f) => f.kind === 'card_number')).toBe(true)
    expect(r.text).toContain(PLACEHOLDERS.card_number)
    expect(r.text).not.toContain('4242')
    expect(r.secretExposed).toBe(true)
  })

  it('does NOT flag non-Luhn digit strings as a card', () => {
    const input = 'number 1234 5678 9012 3456 here'
    const r = redact(input)
    expect(kindsOf(input)).not.toContain('card_number')
    expect(r.text).toBe(input)
    expect(r.secretExposed).toBe(false)
  })

  it('detects Ghana phone formats', () => {
    expect(kindsOf('call 0241234567')).toContain('phone')
    expect(kindsOf('+233241234567')).toContain('phone')
    expect(kindsOf('233 24 123 4567')).toContain('phone')
  })

  it('detects a mobile money number near the keyword', () => {
    expect(kindsOf('send to my momo 0241234567')).toContain('momo_number')
    expect(kindsOf('wallet number 0241234567')).toContain('momo_number')
  })

  it('detects email addresses', () => {
    const r = redact('write to me at john.doe@example.com please')
    expect(kindsOf('john.doe@example.com')).toContain('email')
    expect(r.text).not.toContain('john.doe@example.com')
  })

  it('detects Ghana Card numbers', () => {
    expect(kindsOf('id GHA-123456789-0 done')).toContain('national_id')
  })

  it('redacts OTP / PIN / password disclosures, keeping surrounding words', () => {
    const otp = redact('my otp is 123456 now')
    expect(otp.findings.some((f) => f.kind === 'otp')).toBe(true)
    expect(otp.text).toContain('my otp is')
    expect(otp.text).toContain(PLACEHOLDERS.otp)
    expect(otp.text).not.toContain('123456')

    expect(kindsOf('code: 4821')).toContain('otp')
    expect(kindsOf('my pin is 1234 ok')).toContain('pin')
    expect(kindsOf('password: hunter2 yay')).toContain('password')
    expect(kindsOf('my password is supersecret')).toContain('password')
  })

  it('secretExposed is true only for card/otp/pin/password', () => {
    expect(redact('otp is 123456').secretExposed).toBe(true)
    expect(redact('card 4242 4242 4242 4242').secretExposed).toBe(true)
    expect(redact('pin is 1234').secretExposed).toBe(true)
    expect(redact('password: x').secretExposed).toBe(true)
    // personal data but not secrets:
    expect(redact('call 0241234567 email a@b.com id GHA-123456789-0').secretExposed).toBe(false)
  })

  it('redacted text never contains the original values', () => {
    const text = 'card 4242 4242 4242 4242, phone 0241234567, email a@b.com, otp is 998877'
    const r = redact(text)
    for (const v of ['4242', '0241234567', 'a@b.com', '998877']) {
      expect(r.text).not.toContain(v)
    }
  })

  it('handles multiple items in one message', () => {
    const r = redact('email a@b.com and call 0241234567')
    expect(r.findings.map((f) => f.kind).sort()).toEqual(['email', 'phone'])
  })

  it('returns a message with nothing sensitive unchanged', () => {
    const input = 'hello how are you today'
    const r = redact(input)
    expect(r.text).toBe(input)
    expect(r.findings).toEqual([])
    expect(r.secretExposed).toBe(false)
  })

  it('findings carry offsets into the original text', () => {
    const text = 'call 0241234567'
    const r = redact(text)
    const f = r.findings[0]
    expect(text.slice(f.start, f.end)).toBe('0241234567')
  })

  it('redactForLog applies the same redaction', () => {
    expect(redactForLog('card 4242 4242 4242 4242')).toContain(PLACEHOLDERS.card_number)
    expect(redactForLog('plain message')).toBe('plain message')
  })
})

describe('redact: bare secrets (no connector word)', () => {
  it('redacts a bare one-time code after each secret word', () => {
    for (const input of [
      'OTP 123456',
      'my otp 123456',
      'otp: 123456',
      'verification code 4821',
      'code 4821',
      'one time password 4821',
      'pin 1234',
      'pin number 1234',
      'momo pin 1234',
      'passcode 123456',
      'token 123456',
      'cvv 123',
      'cvc 1234',
    ]) {
      const r = redact(input)
      expect(r.secretExposed, input).toBe(true)
      expect(r.text, input).not.toMatch(/\d{3,8}/)
    }
  })

  it('redacts the two golden cases that leaked a bare OTP', () => {
    for (const input of [
      'Here is my OTP 123456 for the payment',
      'Use OTP 999999 to finish my refund',
    ]) {
      const r = redact(input)
      expect(r.text, input).not.toContain('123456')
      expect(r.text, input).not.toContain('999999')
      expect(r.secretExposed, input).toBe(true)
      expect(r.findings.some((f) => f.kind === 'otp'), input).toBe(true)
    }
  })

  it('uses the matching kind for each secret word', () => {
    expect(kindsOf('OTP 123456')).toContain('otp')
    expect(kindsOf('pin 1234')).toContain('pin')
    expect(kindsOf('passcode 123456')).toContain('password')
    expect(kindsOf('token 123456')).toContain('password')
    expect(kindsOf('cvv 123')).toContain('cvv')
    expect(kindsOf('cvc 1234')).toContain('cvv')
  })

  it('does NOT redact a number that is clearly not a secret', () => {
    for (const input of [
      'my order 12345 has not arrived',
      'the total price is 4500',
      'my delivery took 123 days',
      'the promo code for order 12345',
    ]) {
      const r = redact(input)
      expect(r.text, input).toBe(input)
      expect(r.secretExposed, input).toBe(false)
    }
  })

  it('still redacts the connector forms', () => {
    expect(kindsOf('my otp is 123456')).toContain('otp')
    expect(kindsOf('code: 4821')).toContain('otp')
    expect(kindsOf('my pin is 1234')).toContain('pin')
    expect(kindsOf('password: hunter2')).toContain('password')
  })
})
