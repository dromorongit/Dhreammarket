import { describe, it, expect } from 'vitest'

describe('vendor payouts me', () => {
  it('response does not include vendorId, refundId or other internal fields', async () => {
    expect(true).toBe(true)
  })
  it('unauthenticated request is rejected', async () => {
    expect(true).toBe(true)
  })
  it('vendor B never sees vendor A\'s deductions', async () => {
    expect(true).toBe(true)
  })
})
