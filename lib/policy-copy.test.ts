import { describe, it, expect } from 'vitest'
import {
  POLICY_EFFECTIVE_DATE,
  POLICY_EFFECTIVE_DATE_DISPLAY,
  CANCELLATION_PARAGRAPH,
  CANCELLATION_FAQ_SHORT,
  RETURNS_RULE,
  RETURN_REVIEW,
  REFUND_TIMING,
  PAYOUT_RULE,
  COMMISSION_RULE,
  MANUAL_ORDERS_COMMISSION,
  COMPLETION_RULE,
} from '@/lib/policy-copy'
import {
  CANCELLATION_FEE_GHS,
  FREE_WINDOW_MINUTES,
  BLOCK_THRESHOLD,
  BLOCK_WINDOW_DAYS,
  BLOCK_MONTHS,
} from '@/lib/cancellation-policy'

describe('lib/policy-copy', () => {
  it('exposes the effective date', () => {
    expect(POLICY_EFFECTIVE_DATE).toBe('2027-01-11')
  })

  it('the effective date appears in the display line', () => {
    expect(POLICY_EFFECTIVE_DATE_DISPLAY).toContain('11 January 2027')
    expect(POLICY_EFFECTIVE_DATE_DISPLAY).toContain(
      'Orders placed before this date are handled under the policies in place when they were placed.',
    )
  })

  it('the cancellation constant contains the fee, 60 minutes, 4, 30 days and 3 months from lib/cancellation-policy.ts', () => {
    expect(CANCELLATION_PARAGRAPH).toContain(`GHS ${CANCELLATION_FEE_GHS} fee`)
    expect(CANCELLATION_PARAGRAPH).toContain(`${FREE_WINDOW_MINUTES} minutes`)
    expect(CANCELLATION_PARAGRAPH).toContain(`Cancelling ${BLOCK_THRESHOLD} orders`)
    expect(CANCELLATION_PARAGRAPH).toContain(`within any ${BLOCK_WINDOW_DAYS} days`)
    expect(CANCELLATION_PARAGRAPH).toContain(`for the next ${BLOCK_MONTHS} months`)
    expect(CANCELLATION_PARAGRAPH).toContain('Paystack\'s processing fee is not refunded')
    expect(CANCELLATION_PARAGRAPH).toContain('Unpaid and manual orders are exempt')
  })

  it('the short FAQ cancellation version is built from the same constants', () => {
    expect(CANCELLATION_FAQ_SHORT).toContain(`${FREE_WINDOW_MINUTES} minutes`)
    expect(CANCELLATION_FAQ_SHORT).toContain(`GHS ${CANCELLATION_FEE_GHS} fee`)
    expect(CANCELLATION_FAQ_SHORT).toContain('Paystack\'s processing fee is not refunded')
  })

  it('returns rule states the 1 day Greater Accra / 3 days otherwise window', () => {
    expect(RETURNS_RULE).toContain('Greater Accra Region')
    expect(RETURNS_RULE).toContain('within 3 days otherwise')
    expect(RETURNS_RULE).toContain('Manual orders always use the 3-day return window')
  })

  it('return review states 1 business day from submission', () => {
    expect(RETURN_REVIEW).toBe(
      'The vendor has 1 business day to review a return request, counted from when you submit it.',
    )
  })

  it('refund timing states 24 hours and provider dependence', () => {
    expect(REFUND_TIMING).toBe(
      'Once a return is approved, Dhream Market processes the refund within 24 hours. How long the money takes to appear in your bank or mobile money account after that depends on your payment provider.',
    )
  })

  it('payout rule states 1% commission, Paystack not deducted, 2 business days, hold while open', () => {
    expect(PAYOUT_RULE).toContain('1% platform commission')
    expect(PAYOUT_RULE).toContain('Paystack processing fees are added to the customer\'s payment, not deducted from the vendor')
    expect(PAYOUT_RULE).toContain('within 2 business days after the vendor marks the order completed')
    expect(PAYOUT_RULE).toContain('While a return or dispute is open, the payout is held until it is settled')
    expect(PAYOUT_RULE).toContain('Business days are Monday to Friday and exclude Ghanaian public holidays')
  })

  it('commission rule states 1% of product price only not shipping', () => {
    expect(COMMISSION_RULE).toBe(
      'Platform commission is 1% of the product price only (not shipping), deducted from the vendor\'s earnings before payout.',
    )
  })

  it('manual orders commission states 0% and vendor pays Paystack fee', () => {
    expect(MANUAL_ORDERS_COMMISSION).toBe(
      'Manual orders: 0% commission. The Paystack processing fee on a manual order is paid by the vendor.',
    )
  })

  it('completion rule states vendor marks completed only after buyer receives', () => {
    expect(COMPLETION_RULE).toContain('the vendor marks the order completed only after the buyer has received it')
  })
})
