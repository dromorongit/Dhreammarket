import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

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
} from '@/lib/policy-copy'
import {
  CANCELLATION_FEE_GHS,
  FREE_WINDOW_MINUTES,
  BLOCK_THRESHOLD,
  BLOCK_WINDOW_DAYS,
  BLOCK_MONTHS,
} from '@/lib/cancellation-policy'

import { MANUAL_ORDERS_COMMISSION, COMPLETION_RULE } from '@/lib/policy-copy'

const STALE_PHRASES = [
  '3 days of receiving',
  'within 3 days of receiving',
  '7 days of receiving',
  'within 7 days of receiving',
  '7-day return window',
  'return window of 7 days',
  '7-day window',
  '2.5%',
  'deducted by Paystack before payout',
  'Paystack fees are deducted',
  'deducted by Paystack',
  '3-5 business days',
  '10-14 business days',
  '5-10 business days',
  '1-3 business days',
  'minus platform commission (if applicable) and payment processing fees',
  'customer pays return shipping',
  'customer is responsible for return shipping',
  'Customer is responsible for return shipping costs',
  'Customer covers shipping for change of mind',
  'change-of-mind returns are the customer',
  'customer covers shipping for change of mind',
]

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (/^(node_modules|\.next|\.git|docs|audit|backups|coverage|playwright|prisma)$/i.test(entry.name)) continue
      yield* walk(full)
    } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      if (full.endsWith('.test.ts') || full.endsWith('.test.tsx')) continue
      yield full
    }
  }
}

function collectStale(root: string): Array<{ file: string; line: number; phrase: string }> {
  const violations: Array<{ file: string; line: number; phrase: string }> = []
  for (const file of walk(root)) {
    const content = fs.readFileSync(file, 'utf8')
    const lines = content.split('\n')
    for (const phrase of STALE_PHRASES) {
      lines.forEach((line, i) => {
        if (line.includes(phrase)) {
          violations.push({ file: path.relative(root, file), line: i + 1, phrase })
        }
      })
    }
  }
  return violations
}

describe('policy copy consistency — canonical constants', () => {
  it('POLICY_EFFECTIVE_DATE is a fixed constant', () => {
    expect(POLICY_EFFECTIVE_DATE).toBe('2027-01-11')
  })

  it('RETURNS_RULE states Greater Accra 1 day / 3 days otherwise from COMPLETED', () => {
    expect(RETURNS_RULE).toContain('Greater Accra Region')
    expect(RETURNS_RULE).toContain('within 1 day')
    expect(RETURNS_RULE).toContain('3 days otherwise')
    expect(RETURNS_RULE).toContain('vendor marking the order completed')
    expect(RETURNS_RULE).toContain('Manual orders always use the 3-day return window')
  })

  it('RETURN_REVIEW states 1 business day from submission', () => {
    expect(RETURN_REVIEW).toBe(
      'The vendor has 1 business day to review a return request, counted from when you submit it.',
    )
  })

  it('REFUND_TIMING states 24 hours and provider dependence', () => {
    expect(REFUND_TIMING).toBe(
      'Once a return is approved, Dhream Market processes the refund within 24 hours. How long the money takes to appear in your bank or mobile money account after that depends on your payment provider.',
    )
  })

  it('PAYOUT_RULE states 1% commission, Paystack added to customer not vendor, 2 business days, hold while open', () => {
    expect(PAYOUT_RULE).toContain('1% platform commission')
    expect(PAYOUT_RULE).toContain('Paystack processing fees are added to the customer\'s payment, not deducted from the vendor')
    expect(PAYOUT_RULE).toContain('within 2 business days after the vendor marks the order completed')
    expect(PAYOUT_RULE).toContain('no open returns or disputes')
    expect(PAYOUT_RULE).toContain('Business days are Monday to Friday and exclude Ghanaian public holidays')
  })

  it('COMMISSION_RULE states 1% of product price only not shipping', () => {
    expect(COMMISSION_RULE).toBe(
      'Platform commission is 1% of the product price only (not shipping), deducted from the vendor\'s earnings before payout.',
    )
  })

  it('MANUAL_ORDERS_COMMISSION states 0% commission and vendor pays Paystack fee', () => {
    expect(MANUAL_ORDERS_COMMISSION).toBe(
      'Manual orders: 0% commission. The Paystack processing fee on a manual order is paid by the vendor.',
    )
  })

  it('COMPLETION_RULE states vendor marks completed only after buyer receives', () => {
    expect(COMPLETION_RULE).toContain('the vendor marks the order completed only after the buyer has received it')
  })

  it('CANCELLATION_PARAGRAPH matches founder cancellation decision', () => {
    expect(CANCELLATION_PARAGRAPH).toContain(`1 hour`)
    expect(CANCELLATION_PARAGRAPH).toContain(`(${FREE_WINDOW_MINUTES} minutes)`)
    expect(CANCELLATION_PARAGRAPH).toContain(`GHS ${CANCELLATION_FEE_GHS} fee`)
    expect(CANCELLATION_PARAGRAPH).toContain('cannot be cancelled')
    expect(CANCELLATION_PARAGRAPH).toContain(`Cancelling ${BLOCK_THRESHOLD} orders`)
    expect(CANCELLATION_PARAGRAPH).toContain(`within any ${BLOCK_WINDOW_DAYS} days`)
    expect(CANCELLATION_PARAGRAPH).toContain(`for the next ${BLOCK_MONTHS} months`)
    expect(CANCELLATION_PARAGRAPH).toContain('Paystack\'s processing fee is not refunded')
  })

  it('CANCELLATION_FAQ_SHORT is built from the same constants', () => {
    expect(CANCELLATION_FAQ_SHORT).toContain(`${FREE_WINDOW_MINUTES} minutes`)
    expect(CANCELLATION_FAQ_SHORT).toContain(`GHS ${CANCELLATION_FEE_GHS} fee`)
    expect(CANCELLATION_FAQ_SHORT).toContain('Paystack\'s processing fee is not refunded')
  })

  it('POLICY_EFFECTIVE_DATE_DISPLAY references the effective date', () => {
    expect(POLICY_EFFECTIVE_DATE_DISPLAY).toContain('11 January 2027')
  })
})

describe('policy copy consistency — no stale phrases in display copy', () => {
  it('no source file contains retired policy phrases', () => {
    const root = process.cwd()
    const violations = collectStale(root)
    expect(violations).toEqual([])
  })
})
