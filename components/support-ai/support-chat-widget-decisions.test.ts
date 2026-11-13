import { describe, it, expect } from 'vitest'
import {
  SUPPORT_AI_V2_NOTICE_APPROVED,
  SUPPORT_AI_V2_NOTICE_NO_SECRETS,
} from '@/lib/support-ai/support-ai-constants'
import {
  CONFIG_TIMEOUT_MS,
  V2_CHAT_TIMEOUT_MS,
  HUMAN_SUPPORT_TEXT,
  extractSource,
  resolveSupportAiMode,
  shouldRenderWidget,
  buildV2ErrorMessage,
  buildV2FeedbackPayload,
  buildV2EscalatePayload,
  buildEscalationConfirmation,
} from './support-chat-widget-decisions'

describe('components/support-ai v2 widget decisions', () => {
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

  it('config choice: resolves v2 only when config returns v2, otherwise falls back to v1', () => {
    expect(resolveSupportAiMode('v2')).toBe('v2')
    expect(resolveSupportAiMode('v1')).toBe('v1')
    expect(resolveSupportAiMode(undefined)).toBe('v1')
    expect(resolveSupportAiMode('unexpected')).toBe('v1')
  })

  it('config choice: hides widget for admin on v1 but allows v2/admin-safe modes as resolved', () => {
    expect(shouldRenderWidget('ADMIN', 'v1')).toBe(false)
    expect(shouldRenderWidget('SUPER_ADMIN', 'v1')).toBe(false)
    expect(shouldRenderWidget('ADMIN', 'v2')).toBe(true)
    expect(shouldRenderWidget('CUSTOMER', 'v1')).toBe(true)
    expect(shouldRenderWidget('VENDOR', 'v2')).toBe(true)
  })

  it('timeout and retry state: uses configured timeouts and builds retryable human-support error', () => {
    expect(CONFIG_TIMEOUT_MS).toBe(5000)
    expect(V2_CHAT_TIMEOUT_MS).toBe(20000)
    expect(buildV2ErrorMessage()).toEqual({
      action: 'ERROR',
      content: HUMAN_SUPPORT_TEXT,
      retry: true,
    })
    expect(HUMAN_SUPPORT_TEXT).toContain('human support')
  })

  it('feedback payload: includes conversation/trace/helpful and normalizes optional reason', () => {
    expect(
      buildV2FeedbackPayload({
        conversationId: 'conv-1',
        traceId: 'trace-1',
        helpful: true,
        reason: 'Clear answer',
      }),
    ).toEqual({
      conversationId: 'conv-1',
      traceId: 'trace-1',
      helpful: true,
      reason: 'Clear answer',
    })
    expect(
      buildV2FeedbackPayload({
        conversationId: 'conv-2',
        traceId: 'trace-2',
        helpful: false,
      }),
    ).toEqual({
      conversationId: 'conv-2',
      traceId: 'trace-2',
      helpful: false,
      reason: null,
    })
  })

  it('escalation message/payload: sends conversation id and shows ticket reference confirmation', () => {
    expect(buildV2EscalatePayload('conv-9')).toEqual({ conversationId: 'conv-9' })
    expect(buildEscalationConfirmation('T-123')).toBe(
      'We have created a support ticket. Your reference is T-123. Our team will follow up.',
    )
  })
})
