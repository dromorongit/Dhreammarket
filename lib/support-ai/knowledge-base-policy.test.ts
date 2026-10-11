import { describe, it, expect } from 'vitest'
import { supportKnowledgeBase } from './knowledge-base'

describe('Support AI Knowledge Base Policy Alignment', () => {
  const refundIntent = supportKnowledgeBase.find(i => i.id === 'refund-policy')
  const payoutTimingIntent = supportKnowledgeBase.find(i => i.id === 'vendor-payout-timing')
  const cancellationIntent = supportKnowledgeBase.find(i => i.id === 'order-modification-cancellation')
  const deleteAccountIntent = supportKnowledgeBase.find(i => i.id === 'delete-account')

  it('refund policy mentions 3 days return window', () => {
    expect(refundIntent).toBeDefined()
    expect(refundIntent!.response).toContain('3 days')
    expect(refundIntent!.response).not.toContain('7 days')
    expect(refundIntent!.response).not.toContain('7-day')
  })

  it('refund policy mentions 3-5 business days processing', () => {
    expect(refundIntent).toBeDefined()
    expect(refundIntent!.response).toContain('3-5 business days')
    expect(refundIntent!.response).not.toContain('5-7 business days')
    expect(refundIntent!.response).not.toContain('5 to 7')
  })

  it('refund policy keeps 3 business days vendor review', () => {
    expect(refundIntent).toBeDefined()
    expect(refundIntent!.response).toContain('3 business days')
  })

  it('refund policy includes bank credit note (10-14 business days)', () => {
    expect(refundIntent).toBeDefined()
    expect(refundIntent!.response).toContain('10-14 business days')
  })

  it('payout timing does not contain monthly', () => {
    expect(payoutTimingIntent).toBeDefined()
    expect(payoutTimingIntent!.response).not.toContain('monthly')
    expect(payoutTimingIntent!.response).toContain('2 business days')
    expect(payoutTimingIntent!.response).toContain('dispute')
    expect(payoutTimingIntent!.response).toContain('platform decides')
  })

  it('cancellation mentions 1 hour', () => {
    expect(cancellationIntent).toBeDefined()
    expect(cancellationIntent!.response).toContain('1 hour')
  })

  it('cancellation uses 3-5 business days for refund', () => {
    expect(cancellationIntent).toBeDefined()
    expect(cancellationIntent!.response).toContain('3-5 business days')
    expect(cancellationIntent!.response).not.toContain('5-7 business days')
  })

  it('account deletion mentions audit logs and legally required retention', () => {
    expect(deleteAccountIntent).toBeDefined()
    expect(deleteAccountIntent!.response).toContain('Audit logs')
    expect(deleteAccountIntent!.response).toContain('legally required')
    expect(deleteAccountIntent!.response).not.toContain('remove all your personal data')
    expect(deleteAccountIntent!.response).not.toContain('all your data')
  })

  it('no response contains stale 7-day or 5-7 business day values', () => {
    for (const intent of supportKnowledgeBase) {
      expect(intent.response).not.toMatch(/7 days/i)
      expect(intent.response).not.toMatch(/7-day/i)
      expect(intent.response).not.toMatch(/5-7 business/i)
      expect(intent.response).not.toMatch(/5 to 7/i)
    }
  })
})