import { describe, it, expect } from 'vitest'
import { GHANA_REGIONS, isValidGhanaRegion, CANCELLATION_POLICY_CHECKOUT_NOTICE, CANCELLATION_FEE_GHS } from '@/lib/cancellation-policy'

describe('lib/cancellation-policy', () => {
  it('lists exactly the 16 regions of Ghana', () => {
    expect(GHANA_REGIONS).toEqual([
      'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
      'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
      'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
    ])
    expect(new Set(GHANA_REGIONS).size).toBe(16)
  })

  it('validates canonical region names', () => {
    for (const region of GHANA_REGIONS) {
      expect(isValidGhanaRegion(region)).toBe(true)
    }
    expect(isValidGhanaRegion('Greater Accra Region')).toBe(false)
    expect(isValidGhanaRegion('Brong-Ahafo')).toBe(false)
    expect(isValidGhanaRegion('Nowhere')).toBe(false)
    expect(isValidGhanaRegion(null)).toBe(false)
    expect(isValidGhanaRegion(undefined)).toBe(false)
    expect(isValidGhanaRegion('')).toBe(false)
  })

  it('exposes the fee and the exact checkout notice', () => {
    expect(CANCELLATION_FEE_GHS).toBe(5)
    expect(CANCELLATION_POLICY_CHECKOUT_NOTICE).toBe(
      'Free cancellation within 1 hour of ordering if the order has not shipped. After that, a GHS 5 cancellation fee applies. Paystack\'s processing fee is not refunded. Cancelling 4 orders within 30 days blocks all cancellations for 3 months.'
    )
  })
})
