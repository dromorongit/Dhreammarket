import { getPrisma } from '@/lib/prisma'

const SUPPORT_AI_V2_CHAT_ACTION = 'SUPPORT_AI_V2_CHAT'

export function isValidSupportAiConversationId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 100 && /^[A-Za-z0-9_-]+$/.test(value)
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
