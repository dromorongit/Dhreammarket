/**
 * Redaction.
 *
 * Pure function over the normalized user text. Returns a RedactedMessage with
 * placeholder-substituted `text`, `findings` (kind + offsets in the ORIGINAL
 * text), and `secretExposed`.
 *
 * Detection:
 *  - Payment cards: 13-19 digits (optional spaces/dashes) that pass Luhn.
 *    Non-Luhn digit strings are NOT flagged as cards.
 *  - Ghana phones: 0+9 digits, or +233/233 + 9 digits (optional spaces/dots/dashes).
 *  - Mobile money: a Ghana phone near "momo" / "mobile money" / "wallet".
 *  - Emails.
 *  - Ghana Card: GHA-123456789-0.
 *  - OTP / PIN / password disclosures by phrasing (value redacted, words kept).
 *  - BARE secrets: a 3-8 digit value with no connector word, e.g. "OTP 123456",
 *    "my otp 123456", "code 4821", "pin number 1234", "cvv 123".
 *
 * secretExposed is true for card / otp / pin / password / cvv only.
 */

import type { RedactedMessage, RedactionFinding, SensitiveKind } from '../types'

export const PLACEHOLDERS: Record<SensitiveKind, string> = {
  card_number: '[CARD_REDACTED]',
  otp: '[OTP_REDACTED]',
  pin: '[PIN_REDACTED]',
  password: '[PASSWORD_REDACTED]',
  cvv: '[CVV_REDACTED]',
  phone: '[PHONE_REDACTED]',
  email: '[EMAIL_REDACTED]',
  national_id: '[ID_REDACTED]',
  momo_number: '[PHONE_REDACTED]',
}

const SECRET_KINDS = new Set<SensitiveKind>(['card_number', 'otp', 'pin', 'password', 'cvv'])

// Lower number wins an overlap.
const PRIORITY: Record<SensitiveKind, number> = {
  card_number: 0,
  otp: 1,
  pin: 2,
  password: 3,
  cvv: 4,
  national_id: 5,
  momo_number: 6,
  phone: 7,
  email: 8,
}

interface Candidate {
  kind: SensitiveKind
  start: number
  end: number
}

function luhnValid(digits: string): boolean {
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48
    if (n < 0 || n > 9) return false
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

function findCards(text: string): Candidate[] {
  const out: Candidate[] = []
  const patterns = [
    /(?<!\d)\d{13,19}(?!\d)/g, // contiguous
    /(?<![\d-])(?:\d{4}[ -]){2,4}\d{1,4}(?![\d-])/g, // grouped 4s
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const digits = m[0].replace(/[^0-9]/g, '')
      if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
        out.push({ kind: 'card_number', start: m.index, end: m.index + m[0].length })
      }
      if (re.lastIndex === m.index) re.lastIndex++
    }
  }
  return out
}

function findGhanaCard(text: string): Candidate[] {
  const out: Candidate[] = []
  const re = /GHA-\d{9}-\d{1}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ kind: 'national_id', start: m.index, end: m.index + m[0].length })
  }
  return out
}

function findEmails(text: string): Candidate[] {
  const out: Candidate[] = []
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ kind: 'email', start: m.index, end: m.index + m[0].length })
  }
  return out
}

function findPhones(text: string): Candidate[] {
  const out: Candidate[] = []
  const intl = /(?<![\d+])\+?233(?:[ .-]?\d){9}(?!\d)/g
  const natl = /(?<!\d)0(?:[ .-]?\d){9}(?!\d)/g
  for (const re of [intl, natl]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const start = m.index
      const end = start + m[0].length
      // Reclassify as mobile-money if a momo keyword is nearby.
      const before = text.slice(Math.max(0, start - 30), start)
      const isMomo = /\b(momo|mobile money|wallet)\b/i.test(before)
      out.push({ kind: isMomo ? 'momo_number' : 'phone', start, end })
    }
  }
  return out
}

// Phrase disclosures; capture the VALUE to redact. The `d` flag exposes
// capture-group offsets via match.indices.
const PHRASE_DETECTORS: { re: RegExp; kind: SensitiveKind }[] = [
  { re: /(otp|one[ -]?time (?:code|password|pin))\s*(?:is|:|=|was)\s*(\S+)/gid, kind: 'otp' },
  { re: /\bcode\b\s*(?:is|:|=|was)\s*(\S+)/gid, kind: 'otp' },
  { re: /\bpin\b\s*(?:is|:|=|was)\s*(\S+)/gid, kind: 'pin' },
  { re: /\b(?:password|passwd)\b\s*(?:is|:|=|was)\s*(\S+)/gid, kind: 'password' },
]

function findPhrases(text: string): Candidate[] {
  const out: Candidate[] = []
  for (const { re, kind } of PHRASE_DETECTORS) {
    const g = new RegExp(re.source, re.flags) // fresh lastIndex
    let m: RegExpExecArray | null
    while ((m = g.exec(text)) !== null) {
      const idx = m.indices?.[2] ?? m.indices?.[1]
      if (idx) out.push({ kind, start: idx[0], end: idx[1] })
    }
  }
  return out
}

// --- BARE SECRETS --------------------------------------------------------
//
// A secret does not need a connector word. "OTP 123456", "my otp 123456",
// "otp: 123456", "verification code 4821", "code 4821", "one time password
// 4821", "pin 1234", "pin number 1234", "momo pin 1234", "passcode 123456",
// "token 123456" and "cvv 123" are all real ways a user pastes a secret.
//
// Rule: a standalone number of 3 to 8 digits, at most 3 words after one of
// the secret words below, is redacted as the matching kind and sets
// secretExposed.
const BARE_SECRET_RE =
  /\b(otp|one[ -]?time (?:code|password|pin)|verification code|security code|verification|code|pin number|pin|passcode|password|passwd|token|cvv|cvc)\b(?<gap>[^0-9\n]{0,40}?)(?<num>\d{3,8})\b/gid

/**
 * Words that show the number is an identifier or a price, not a secret.
 * "promo code for order 12345" and "the code costs 450" are not secrets.
 */
const NON_SECRET_CONTEXT =
  /\b(order|orders|item|items|product|products|invoice|reference|ref|tracking|price|prices|amount|total|cost|costs|ghs|gh¢|₵|cedi|ngn|zar|usd|ghp|quantity|qty)\b/i

function findBareSecrets(text: string): Candidate[] {
  const out: Candidate[] = []
  const re = new RegExp(BARE_SECRET_RE.source, BARE_SECRET_RE.flags)
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const numIdx = m.indices?.groups?.num
    const gapIdx = m.indices?.groups?.gap
    if (!numIdx) continue

    // A number that is clearly an identifier or a price is not a secret.
    const gap = gapIdx ? text.slice(gapIdx[0], gapIdx[1]) : ''
    if (gap && NON_SECRET_CONTEXT.test(gap)) continue
    // A currency or price word right before the number has the same effect.
    const before = text.slice(Math.max(0, numIdx[0] - 24), numIdx[0])
    if (NON_SECRET_CONTEXT.test(before)) continue

    const keyword = (m[1] ?? '').toLowerCase()
    let kind: SensitiveKind = 'otp'
    if (/\b(pin)\b/.test(keyword)) kind = 'pin'
    else if (/\b(passcode|password|passwd|token)\b/.test(keyword)) kind = 'password'
    else if (/\b(cvv|cvc)\b/.test(keyword)) kind = 'cvv'
    else if (/\bone[ -]?time (password|pin)\b/.test(keyword)) kind = 'password'

    out.push({ kind, start: numIdx[0], end: numIdx[1] })
  }
  return out
}

function resolveOverlaps(candidates: Candidate[]): Candidate[] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    const p = PRIORITY[a.kind] - PRIORITY[b.kind]
    if (p !== 0) return p
    return b.end - b.end
  })
  const accepted: Candidate[] = []
  let lastEnd = -1
  for (const c of sorted) {
    if (c.start >= lastEnd) {
      accepted.push(c)
      lastEnd = c.end
    }
  }
  return accepted
}

export function redact(text: string): RedactedMessage {
  if (typeof text !== 'string') {
    throw new Error('redact expects a string')
  }
  const candidates = [
    ...findCards(text),
    ...findGhanaCard(text),
    ...findEmails(text),
    ...findPhones(text),
    ...findPhrases(text),
    ...findBareSecrets(text),
  ]
  const accepted = resolveOverlaps(candidates).sort((a, b) => a.start - b.start)

  const findings: RedactionFinding[] = accepted.map((c) => ({
    kind: c.kind,
    start: c.start,
    end: c.end,
  }))

  let out = ''
  let cursor = 0
  for (const c of accepted) {
    out += text.slice(cursor, c.start) + PLACEHOLDERS[c.kind]
    cursor = c.end
  }
  out += text.slice(cursor)

  const secretExposed = accepted.some((c) => SECRET_KINDS.has(c.kind))

  return { text: out, findings, secretExposed }
}

/** Apply the same redaction to any string before it is logged. */
export function redactForLog(value: string): string {
  if (typeof value !== 'string') return String(value)
  return redact(value).text
}

// TODO(known gap): street addresses are intentionally NOT detected. Add when
// policy + an owner-approved address regex are agreed. See README.
