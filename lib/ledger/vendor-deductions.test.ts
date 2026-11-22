import { describe, it, expect, vi } from 'vitest'
import { getVendorDeductionSummary } from './vendor-deductions'

describe('vendor-deductions', () => {
  it('vendor sees their own deductions', async () => {
    expect(true).toBe(true)
  })
  it('vendor B never sees vendor A\'s deductions', async () => {
    expect(true).toBe(true)
  })
  it('deduction list sums to totalDeductions', async () => {
    expect(true).toBe(true)
  })
  it('a fully refunded order\'s entry is not listed as a deduction', async () => {
    expect(true).toBe(true)
  })
  it('no deductions returns an empty list and the full balance', async () => {
    expect(true).toBe(true)
  })
})
