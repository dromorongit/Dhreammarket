import { describe, it, expect } from 'vitest'
import { supportKnowledgeBase } from './knowledge-base'
import * as fs from 'fs'
import * as path from 'path'

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

  it('no response contains stale 7-day or 5-7 business day values', () => {
    for (const intent of supportKnowledgeBase) {
      expect(intent.response).not.toMatch(/7 days/i)
      expect(intent.response).not.toMatch(/7-day/i)
      expect(intent.response).not.toMatch(/5-7 business/i)
      expect(intent.response).not.toMatch(/5 to 7/i)
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

  it('returns page mentions 3 days return window', () => {
    const content = fs.readFileSync(returnsPagePath, 'utf-8')
    expect(content).toContain('within 3 days')
  })

  it('returns page does not contain 5-7 business days', () => {
    const content = fs.readFileSync(returnsPagePath, 'utf-8')
    expect(content).not.toContain('5-7 business days')
    expect(content).not.toContain('5 to 7')
  })

  it('returns page mentions 3-5 business days processing', () => {
    const content = fs.readFileSync(returnsPagePath, 'utf-8')
    expect(content).toContain('3-5 business days')
  })

  it('returns page includes bank credit note (10-14 business days)', () => {
    const content = fs.readFileSync(returnsPagePath, 'utf-8')
    expect(content).toContain('10-14 business days')
  })

  it('refunds page does not contain 5-7 business days', () => {
    const content = fs.readFileSync(refundsPagePath, 'utf-8')
    expect(content).not.toContain('5-7 business days')
    expect(content).not.toContain('5 to 7')
  })

  it('refunds page mentions 3-5 business days processing', () => {
    const content = fs.readFileSync(refundsPagePath, 'utf-8')
    expect(content).toContain('3-5 business days')
  })

  it('refunds page includes bank credit note (10-14 business days)', () => {
    const content = fs.readFileSync(refundsPagePath, 'utf-8')
    expect(content).toContain('10-14 business days')
  })

  it('help client does not contain 5-7 business days', () => {
    const content = fs.readFileSync(helpClientPath, 'utf-8')
    expect(content).not.toContain('5-7 business days')
    expect(content).not.toContain('5 to 7')
  })

  it('help client mentions 3-5 business days processing', () => {
    const content = fs.readFileSync(helpClientPath, 'utf-8')
    expect(content).toContain('3-5 business days')
  })

  it('help client includes bank credit note (10-14 business days)', () => {
    const content = fs.readFileSync(helpClientPath, 'utf-8')
    expect(content).toContain('10-14 business days')
  })
})