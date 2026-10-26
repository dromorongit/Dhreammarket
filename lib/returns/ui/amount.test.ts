import { describe, it, expect } from 'vitest'
import {
  parseAmountToPesewas,
  formatGhs,
  comparePesewas,
  gtePesewas,
  ltPesewas,
} from './amount'

describe('parseAmountToPesewas', () => {
  it.each([
    ['10', 1000],
    ['10.5', 1050],
    ['10.50', 1050],
    ['10.55', 1055],
    ['0.01', 1],
    [' 5 ', 500],
    ['007', 700],
  ])('parses %s to %i pesewas', (input, expected) => {
    const result = parseAmountToPesewas(input)
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') expect(result.pesewas).toBe(expected)
  })

  it.each([
    ['0', 'NOT_POSITIVE'],
    ['0.00', 'NOT_POSITIVE'],
    ['-1', 'NOT_POSITIVE'],
    ['-0.50', 'NOT_POSITIVE'],
    ['', 'EMPTY'],
    ['   ', 'EMPTY'],
    ['abc', 'NOT_A_NUMBER'],
    ['1e3', 'NOT_A_NUMBER'],
    ['1E3', 'NOT_A_NUMBER'],
    ['10.555', 'TOO_MANY_DECIMALS'],
    ['10.', 'NOT_A_NUMBER'],
    ['.5', 'NOT_A_NUMBER'],
    ['1,000.00', 'NOT_A_NUMBER'],
    ['12 34', 'NOT_A_NUMBER'],
  ])('rejects %s with %s', (input, code) => {
    const result = parseAmountToPesewas(input)
    expect(result.kind).toBe('err')
    if (result.kind === 'err') expect(result.error.code).toBe(code)
  })

  it('respects the maximum one pesewa either side', () => {
    const max = 1050
    expect(parseAmountToPesewas('10.50', max).kind).toBe('ok')
    expect(parseAmountToPesewas('10.49', max).kind).toBe('ok')
    const over = parseAmountToPesewas('10.51', max)
    expect(over.kind).toBe('err')
    if (over.kind === 'err') expect(over.error.code).toBe('ABOVE_MAX')
  })

  it('handles very large values without floating point', () => {
    const result = parseAmountToPesewas('9999999999999999.99')
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      const overLimit = parseAmountToPesewas('9999999999999999.99', 100)
      expect(overLimit.kind).toBe('err')
      if (overLimit.kind === 'err') expect(overLimit.error.code).toBe('ABOVE_MAX')
    }
  })
})

describe('formatGhs', () => {
  it('formats strings and numbers', () => {
    expect(formatGhs('10')).toContain('10.00')
    expect(formatGhs(10)).toContain('10.00')
    expect(formatGhs('10.5')).toContain('10.50')
    expect(formatGhs('0.01')).toContain('0.01')
    expect(formatGhs('1000000')).toContain('1,000,000.00')
    expect(formatGhs('1,000.00')).toContain('1,000.00')
  })

  it('does not crash on awkward values', () => {
    expect(formatGhs('-5')).toContain('5.00')
    expect(formatGhs(0)).toContain('0.00')
  })
})

describe('comparison helpers', () => {
  it('compares on pesewas', () => {
    expect(comparePesewas(500, 1000)).toBe(-1)
    expect(comparePesewas(1000, 500)).toBe(1)
    expect(comparePesewas(1000, 1000)).toBe(0)
    expect(gtePesewas(1000, 1000)).toBe(true)
    expect(gtePesewas(999, 1000)).toBe(false)
    expect(ltPesewas(999, 1000)).toBe(true)
  })
})
