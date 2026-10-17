import { describe, it, expect } from 'vitest'
import { normalizeGhanaPhone, normalizeGhanaPhoneNumber } from './phone'

describe('normalizeGhanaPhone (alias)', () => {
  it('is the same function as normalizeGhanaPhoneNumber', () => {
    expect(normalizeGhanaPhone).toBe(normalizeGhanaPhoneNumber)
  })
})

describe('normalizeGhanaPhoneNumber edge cases', () => {
  it('normalizes 0XXXXXXXXX format', () => {
    expect(normalizeGhanaPhoneNumber('0242222222')).toBe('+233242222222')
    expect(normalizeGhanaPhoneNumber('0541234567')).toBe('+233541234567')
  })

  it('normalizes +233XXXXXXXXX format', () => {
    expect(normalizeGhanaPhoneNumber('+233242222222')).toBe('+233242222222')
  })

  it('normalizes 233XXXXXXXXX format', () => {
    expect(normalizeGhanaPhoneNumber('233242222222')).toBe('+233242222222')
  })

  it('handles spaces and dashes', () => {
    expect(normalizeGhanaPhoneNumber('024 222 2222')).toBe('+233242222222')
    expect(normalizeGhanaPhoneNumber('024-222-2222')).toBe('+233242222222')
    expect(normalizeGhanaPhoneNumber('+233 242 222 222')).toBe('+233242222222')
  })

  it('returns null for empty input', () => {
    expect(normalizeGhanaPhoneNumber('')).toBeNull()
    expect(normalizeGhanaPhoneNumber(null)).toBeNull()
    expect(normalizeGhanaPhoneNumber(undefined)).toBeNull()
  })

  it('returns null for invalid prefix', () => {
    expect(normalizeGhanaPhoneNumber('0991234567')).toBeNull()
    expect(normalizeGhanaPhoneNumber('0123456789')).toBeNull()
  })

  it('returns null for wrong length', () => {
    expect(normalizeGhanaPhoneNumber('024222222')).toBeNull() // 9 digits starting with 0
    expect(normalizeGhanaPhoneNumber('02422222222')).toBeNull() // 11 digits
    expect(normalizeGhanaPhoneNumber('23324222222')).toBeNull() // 11 digits starting with 233
  })

  it('returns null for non-digit input without valid pattern', () => {
    expect(normalizeGhanaPhoneNumber('abcdefghij')).toBeNull()
  })
})
