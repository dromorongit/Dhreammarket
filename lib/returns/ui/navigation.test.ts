import { describe, it, expect } from 'vitest'
import {
  getReturnsNavItems,
  shouldShowReturnLink,
  buildReturnLinkHref,
} from './navigation'

const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED']
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED']

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'INFLUENCER', 'VENDOR', 'CUSTOMER'] as const

describe('getReturnsNavItems', () => {
  it('returns an empty array for every role when the flag is off', () => {
    for (const role of ALL_ROLES) {
      expect(getReturnsNavItems(role, false)).toEqual([])
    }
  })

  it('returns the customer entry only for CUSTOMER when the flag is on', () => {
    expect(getReturnsNavItems('CUSTOMER', true)).toEqual([
      { label: 'My returns', href: '/dashboard/customer/returns' },
    ])
  })

  it('returns the vendor entry only for VENDOR when the flag is on', () => {
    expect(getReturnsNavItems('VENDOR', true)).toEqual([
      { label: 'Returns', href: '/dashboard/vendor/returns' },
    ])
  })

  it('returns the admin entry only for SUPER_ADMIN when the flag is on', () => {
    expect(getReturnsNavItems('SUPER_ADMIN', true)).toEqual([
      { label: 'Returns', href: '/dashboard/admin/returns' },
    ])
  })

  it('returns no entry for roles that cannot open returns pages', () => {
    expect(getReturnsNavItems('ADMIN', true)).toEqual([])
    expect(getReturnsNavItems('INFLUENCER', true)).toEqual([])
  })
})

describe('shouldShowReturnLink', () => {
  it('is false for every combination when the flag is off', () => {
    for (const orderStatus of ORDER_STATUSES) {
      for (const paymentStatus of PAYMENT_STATUSES) {
        expect(
          shouldShowReturnLink({ flagEnabled: false, orderStatus, paymentStatus })
        ).toBe(false)
      }
    }
  })

  it('is true only for PAID plus DELIVERED or COMPLETED when the flag is on', () => {
    for (const orderStatus of ORDER_STATUSES) {
      for (const paymentStatus of PAYMENT_STATUSES) {
        const expected = paymentStatus === 'PAID' && (orderStatus === 'DELIVERED' || orderStatus === 'COMPLETED')
        expect(
          shouldShowReturnLink({ flagEnabled: true, orderStatus, paymentStatus })
        ).toBe(expected)
      }
    }
  })
})

describe('buildReturnLinkHref', () => {
  it('builds encoded hrefs for normal ids', () => {
    expect(buildReturnLinkHref('abc123')).toBe('/dashboard/customer/returns/new?orderItemId=abc123')
  })

  it('returns null for empty or whitespace', () => {
    expect(buildReturnLinkHref('')).toBeNull()
    expect(buildReturnLinkHref('   ')).toBeNull()
  })

  it('returns null for path traversal and script-like strings', () => {
    expect(buildReturnLinkHref('../secret')).toBeNull()
    expect(buildReturnLinkHref('<script>alert(1)</script>')).toBeNull()
    expect(buildReturnLinkHref('a/b')).toBeNull()
  })
})
