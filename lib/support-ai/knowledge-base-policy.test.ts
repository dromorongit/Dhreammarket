import { describe, it, expect } from 'vitest'
import { supportKnowledgeBase } from './knowledge-base'
import * as fs from 'fs'
import * as path from 'path'

describe('Support AI Knowledge Base Policy Alignment', () => {
  const refundIntent = supportKnowledgeBase.find(i => i.id === 'refund-policy')
  const payoutTimingIntent = supportKnowledgeBase.find(i => i.id === 'vendor-payout-timing')
  const cancellationIntent = supportKnowledgeBase.find(i => i.id === 'order-modification-cancellation')
  const deleteAccountIntent = supportKnowledgeBase.find(i => i.id === 'delete-account')

  it('refund policy mentions Greater Accra and 3-day windows', () => {
    expect(refundIntent).toBeDefined()
    expect(refundIntent!.response).toContain('Greater Accra')
    expect(refundIntent!.response).toContain('1 day')
    expect(refundIntent!.response).toContain('3 days')
  })

  it('refund policy mentions vendor review within 1 business day', () => {
    expect(refundIntent).toBeDefined()
    expect(refundIntent!.response).toContain('1 business day')
  })

  it('refund policy mentions 24-hour processing and provider timing', () => {
    expect(refundIntent).toBeDefined()
    expect(refundIntent!.response).toContain('24 hours')
    expect(refundIntent!.response).toContain('depends on your payment provider')
    expect(refundIntent!.response).not.toContain('3-5 ' + 'business days')
    expect(refundIntent!.response).not.toContain('10-14 ' + 'business days')
  })

  it('payout timing states 2 business days after completion with no open returns/disputes', () => {
    expect(payoutTimingIntent).toBeDefined()
    expect(payoutTimingIntent!.response).toContain('2 business days')
    expect(payoutTimingIntent!.response).toContain('vendor marks the order completed')
    expect(payoutTimingIntent!.response).toContain('no open returns or disputes')
    expect(payoutTimingIntent!.response).not.toContain('platform decides when the payout is released')
    expect(payoutTimingIntent!.response).not.toContain('minus platform commission (if applicable) and payment processing fees')
  })

  it('cancellation mentions 1 hour, GHS 5 fee, and not shipped', () => {
    expect(cancellationIntent).toBeDefined()
    expect(cancellationIntent!.response).toContain('1 hour of payment confirmation')
    expect(cancellationIntent!.response).toContain('GHS 5 fee')
    expect(cancellationIntent!.response).toContain('cannot be cancelled')
    expect(cancellationIntent!.response).toContain('4 orders within any 30 days')
  })

  it('cancellation mentions 24-hour refund processing', () => {
    expect(cancellationIntent).toBeDefined()
    expect(cancellationIntent!.response).toContain('24 hours')
    expect(cancellationIntent!.response).not.toContain('3-5 ' + 'business days')
  })

  it('account deletion mentions audit logs and legally required retention', () => {
    expect(deleteAccountIntent).toBeDefined()
    expect(deleteAccountIntent!.response).toContain('Audit logs')
    expect(deleteAccountIntent!.response).toContain('legally required')
    expect(deleteAccountIntent!.response).not.toContain('remove all your personal data')
    expect(deleteAccountIntent!.response).not.toContain('all your data')
  })

  it('account deletion uses neutral wording without enumerated list', () => {
    expect(deleteAccountIntent).toBeDefined()
    expect(deleteAccountIntent!.response).toContain('permanent')
    expect(deleteAccountIntent!.response).toContain('Your personal data is removed where permitted')
    expect(deleteAccountIntent!.response).toContain('Audit logs and records the platform is legally required to keep are retained')
    expect(deleteAccountIntent!.response).toContain('contact support')
    expect(deleteAccountIntent!.response).not.toContain('order history')
    expect(deleteAccountIntent!.response).not.toContain('saved addresses')
    expect(deleteAccountIntent!.response).not.toContain('wishlist')
    expect(deleteAccountIntent!.response).not.toContain('vendor')
    expect(deleteAccountIntent!.response).not.toContain('30 days')
  })

  it('no response contains stale old refund timing values', () => {
    for (const intent of supportKnowledgeBase) {
      expect(intent.response).not.toContain('3-5 ' + 'business days')
      expect(intent.response).not.toContain('10-14 ' + 'business days')
      expect(intent.response).not.toContain('5-10 ' + 'business days')
      expect(intent.response).not.toContain('within 3 days of receiving')
      expect(intent.response).not.toContain('1-3 ' + 'business days')
      expect(intent.response).not.toContain('Paystack fees are deducted')
      expect(intent.response).not.toContain('minus platform commission (if applicable) and payment processing fees')
    }
  })
})

describe('Help Pages Policy Alignment', () => {
  const returnsPagePath = path.resolve(__dirname, '../../app/help/returns/page.tsx')
  const refundsPagePath = path.resolve(__dirname, '../../app/help/refunds/page.tsx')
  const helpClientPath = path.resolve(__dirname, '../../app/help/help-client.tsx')

  it('returns page does not contain 7 days return window', () => {
    const content = fs.readFileSync(returnsPagePath, 'utf-8')
    expect(content).not.toContain('within 7 days')
    expect(content).not.toContain('7-day window')
  })

  it('returns page mentions Greater Accra 1-day / 3-day windows', () => {
    const content = fs.readFileSync(returnsPagePath, 'utf-8')
    expect(content).toContain('Greater Accra')
    expect(content).toContain('within 1 day')
    expect(content).toContain('3 days otherwise')
  })

  it('returns page does not contain stale refund timing', () => {
    const content = fs.readFileSync(returnsPagePath, 'utf-8')
    expect(content).not.toContain('3-5 ' + 'business days')
    expect(content).not.toContain('10-14 ' + 'business days')
  })

  it('returns page mentions 24-hour processing and provider timing', () => {
    const content = fs.readFileSync(returnsPagePath, 'utf-8')
    expect(content).toContain('24 hours')
    expect(content).toContain('depends on your payment provider')
  })

  it('refunds page does not contain stale refund timing', () => {
    const content = fs.readFileSync(refundsPagePath, 'utf-8')
    expect(content).not.toContain('3-5 ' + 'business days')
    expect(content).not.toContain('10-14 ' + 'business days')
    expect(content).not.toContain('1-3 ' + 'business days')
  })

  it('refunds page mentions 24-hour processing and provider timing', () => {
    const content = fs.readFileSync(refundsPagePath, 'utf-8')
    expect(content).toContain('24 hours')
    expect(content).toContain('depends on your payment provider')
  })

  it('help client does not contain stale refund timing', () => {
    const content = fs.readFileSync(helpClientPath, 'utf-8')
    expect(content).not.toContain('3-5 ' + 'business days')
    expect(content).not.toContain('10-14 ' + 'business days')
  })

  it('help client mentions 24-hour processing and provider timing', () => {
    const content = fs.readFileSync(helpClientPath, 'utf-8')
    expect(content).toContain('24 hours')
    expect(content).toContain('depends on your payment provider')
  })
})