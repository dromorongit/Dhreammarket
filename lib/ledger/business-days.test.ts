import { describe, it, expect } from 'vitest'
import { isBusinessDay, addBusinessDays } from './business-days'

describe('isBusinessDay', () => {
  it('weekdays are business days', () => {
    expect(isBusinessDay(new Date('2026-10-23T17:00:00Z'), [])).toBe(true) // Friday
    expect(isBusinessDay(new Date('2026-10-26T10:00:00Z'), [])).toBe(true) // Monday
  })
  it('weekends are not business days', () => {
    expect(isBusinessDay(new Date('2026-10-24T10:00:00Z'), [])).toBe(false) // Saturday
    expect(isBusinessDay(new Date('2026-10-25T10:00:00Z'), [])).toBe(false) // Sunday
  })
  it('holidays are not business days', () => {
    expect(isBusinessDay(new Date('2026-10-26T10:00:00Z'), ['2026-10-26'])).toBe(false)
  })
})

describe('addBusinessDays', () => {
  it('Friday 17:00 + 2 business days = Tuesday 17:00', () => {
    const from = new Date('2026-10-23T17:00:00Z')
    expect(addBusinessDays(from, 2, []).toISOString()).toBe('2026-10-27T17:00:00.000Z')
  })
  it('Thursday 10:00 + 2 business days = Monday 10:00', () => {
    const from = new Date('2026-10-22T10:00:00Z')
    expect(addBusinessDays(from, 2, []).toISOString()).toBe('2026-10-26T10:00:00.000Z')
  })
  it('holiday Monday pushes Friday completion to Wednesday', () => {
    const from = new Date('2026-10-23T17:00:00Z')
    expect(addBusinessDays(from, 2, ['2026-10-26']).toISOString()).toBe('2026-10-28T17:00:00.000Z')
  })
  it('weekend completion counts from the next business day', () => {
    const from = new Date('2026-10-24T10:00:00Z') // Saturday
    expect(addBusinessDays(from, 2, []).toISOString()).toBe('2026-10-27T10:00:00.000Z')
  })
  it('keeps the time of day', () => {
    const from = new Date('2026-10-23T17:30:00Z')
    expect(addBusinessDays(from, 2, []).toISOString()).toBe('2026-10-27T17:30:00.000Z')
  })
  it('n = 0 returns the same instant', () => {
    const from = new Date('2026-10-23T17:00:00Z')
    expect(addBusinessDays(from, 0, []).toISOString()).toBe(from.toISOString())
  })
})
