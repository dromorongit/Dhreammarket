import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SupportChatMessage, SupportChatMessageV2, extractSource } from '@/components/support-ai/support-chat-message'
import {
  SUPPORT_AI_V2_NOTICE_APPROVED,
  SUPPORT_AI_V2_NOTICE_NO_SECRETS,
} from '@/lib/support-ai/support-ai-constants'

const base = (over: Record<string, any> = {}) => ({
  id: 'm-1',
  role: 'bot',
  content: 'hello',
  timestamp: new Date(),
  ...over,
})

describe('components/support-ai (v2 pilot)', () => {
  it('exposes the two notices from the shared constants file with the approved wording', () => {
    expect(SUPPORT_AI_V2_NOTICE_APPROVED).toBe(
      "I answer questions using Dhream Market's approved help articles. I can't see or change your orders or account.",
    )
    expect(SUPPORT_AI_V2_NOTICE_NO_SECRETS).toBe(
      'Never type your password, OTP, card number or ID number here.',
    )
  })

  it('extractSource splits an answer into body and source title', () => {
    expect(extractSource('Delivery takes 3-7 days\n\nSource: Delivery times')).toEqual({
      content: 'Delivery takes 3-7 days',
      sourceTitle: 'Delivery times',
    })
    expect(extractSource('no source marker')).toEqual({ content: 'no source marker' })
  })

  it('renders v2 answer with body, source title, feedback and human-support button', () => {
    const html = renderToStaticMarkup(
      <SupportChatMessageV2
        message={base({
          action: 'ANSWER',
          content: 'Delivery takes 3-7 days\n\nSource: Delivery times',
          sourceTitle: 'Delivery times',
          traceId: 't-1',
        })}
        onFeedback={vi.fn()}
      />,
    )
    expect(html).toContain('Delivery takes 3-7 days')
    expect(html).toContain('Source: Delivery times')
    expect(html).toContain('Was this helpful?')
    expect(html).toContain('Talk to human support')
  })

  it('renders v2 escalation message with human-support button', () => {
    const html = renderToStaticMarkup(
      <SupportChatMessageV2 message={base({ action: 'ESCALATE', content: 'Escalated via policy gap', reasonCode: 'POLICY_GAP' })} onTalkToHuman={vi.fn()} />,
    )
    expect(html).toContain('Escalated via policy gap')
    expect(html).toContain('Talk to human support')
  })

  it('renders retry button on a v2 error message', () => {
    const html = renderToStaticMarkup(
      <SupportChatMessageV2 message={base({ action: 'ERROR', content: 'Support AI is temporarily unavailable.', retry: true })} />,
    )
    expect(html).toContain('Retry')
  })

  it('shows thanks instead of feedback once rated', () => {
    const html = renderToStaticMarkup(
      <SupportChatMessageV2 message={base({ action: 'ANSWER', content: 'answered' })} rated={true} />,
    )
    expect(html).toContain('Thanks for your feedback.')
    expect(html).not.toContain('Was this helpful?')
  })

  it('v1 message rendering is unchanged', () => {
    const html = renderToStaticMarkup(
      <SupportChatMessage
        message={{ id: 'm-1', role: 'bot', content: 'v1 answer', timestamp: new Date(), suggestedEscalation: true }}
        onEscalate={vi.fn()}
      />,
    )
    expect(html).toContain('v1 answer')
    expect(html).toContain('Talk to a human')
  })
})
