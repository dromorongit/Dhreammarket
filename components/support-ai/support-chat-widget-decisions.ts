import { WHATSAPP_SUPPORT_LINK, SUPPORT_EMAIL } from '@/lib/support-ai/knowledge-base'

export type SupportAiMode = 'v1' | 'v2'
export type V2Action = 'ANSWER' | 'ESCALATE' | 'REFUSE' | 'CLARIFY' | 'ERROR'

export const V2_CHAT_TIMEOUT_MS = 20000
export const CONFIG_TIMEOUT_MS = 5000

export const HUMAN_SUPPORT_TEXT = `Support AI is temporarily unavailable. Please contact our human support team:\n\nWhatsApp: ${WHATSAPP_SUPPORT_LINK}\nEmail: ${SUPPORT_EMAIL}`

export function extractSource(message: string): { content: string; sourceTitle?: string } {
  const idx = message.lastIndexOf('\n\nSource: ')
  if (idx === -1) return { content: message }
  return { content: message.slice(0, idx), sourceTitle: message.slice(idx + 10) }
}

export function resolveSupportAiMode(raw: unknown): SupportAiMode {
  return raw === 'v2' ? 'v2' : 'v1'
}

export function shouldRenderWidget(userRole: string | null | undefined, mode: SupportAiMode): boolean {
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'
  if (isAdmin && mode !== 'v2') return false
  return true
}

export function buildV2ErrorMessage(): { action: 'ERROR'; content: string; retry: true } {
  return { action: 'ERROR', content: HUMAN_SUPPORT_TEXT, retry: true }
}

export function buildV2FeedbackPayload(input: {
  conversationId: string
  traceId: string
  helpful: boolean
  reason?: string | null
}): { conversationId: string; traceId: string; helpful: boolean; reason: string | null } {
  return {
    conversationId: input.conversationId,
    traceId: input.traceId,
    helpful: input.helpful,
    reason: input.reason ?? null,
  }
}

export function buildV2EscalatePayload(conversationId: string): { conversationId: string } {
  return { conversationId }
}

export function buildEscalationConfirmation(reference: string): string {
  return `We have created a support ticket. Your reference is ${reference}. Our team will follow up.`
}
