import { getPrisma } from '@/lib/prisma'

const SUPPORT_AI_V2_CHAT_ACTION = 'SUPPORT_AI_V2_CHAT'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LEGACY_CONVERSATION_ID_RE = /^[A-Za-z0-9_-]{1,100}$/

export function isValidSupportAiConversationId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) return false
  return UUID_RE.test(value) || LEGACY_CONVERSATION_ID_RE.test(value)
}

export function isValidSupportAiTraceId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 100 && /^[A-Za-z0-9_-]+$/.test(value)
}

export async function userOwnsConversation(userId: string, conversationId: string): Promise<boolean> {
  if (!userId || !conversationId) return false

  const audit = await getPrisma().auditLog.findFirst({
    where: {
      userId,
      action: SUPPORT_AI_V2_CHAT_ACTION,
      afterData: {
        path: ['conversationId'],
        equals: conversationId,
      },
    } as any,
    select: { id: true },
  })
  if (audit) return true

  const ticket = await getPrisma().supportTicket.findFirst({
    where: {
      conversationRef: conversationId,
      userId,
    },
    select: { id: true },
  })
  return ticket !== null
}

export async function conversationIdUsedByOtherUser(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  if (!userId || !conversationId) return false

  const audit = await getPrisma().auditLog.findFirst({
    where: {
      action: SUPPORT_AI_V2_CHAT_ACTION,
      NOT: { userId },
      afterData: {
        path: ['conversationId'],
        equals: conversationId,
      },
    } as any,
    select: { id: true },
  })
  return audit !== null
}
