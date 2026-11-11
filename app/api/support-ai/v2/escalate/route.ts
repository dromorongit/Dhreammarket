import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { getServerSession } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { makePorts } from '@/lib/support-ai-v2/ports'
import { resolveRole } from '@/lib/support-ai-v2/src/identity/resolve-role'
import type { Actor } from '@/lib/support-ai-v2/src/types'
import { redact } from '@/lib/support-ai-v2/src/sanitize/redact'
import {
  isValidSupportAiConversationId,
  userOwnsConversation,
} from '@/lib/support-ai-v2/conversation-ownership'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

const MAX_NOTE_CHARS = 500

export async function POST(request: NextRequest) {
  // 1. Authenticate -- logged-out visitors cannot escalate in v2.
  let appSession: { userId: string; role: string; sessionId: string } | null = null
  try {
    appSession = await getServerSession()
  } catch {
    appSession = null
  }
  if (!appSession) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  // 2. Rate limit (per authenticated user).
  const rateLimitCheck = rateLimit('support-ai-chat', appSession.userId)(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const body = (await request.json()) ?? {}
    const { conversationId, note } = body

    if (!isValidSupportAiConversationId(conversationId)) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
    }
    if (note !== undefined && (typeof note !== 'string' || note.length > MAX_NOTE_CHARS)) {
      return NextResponse.json({ error: `note must be a string of ${MAX_NOTE_CHARS} characters or fewer` }, { status: 400 })
    }

    const redactedNote = note ? redact(note).text : null

    const owns = await userOwnsConversation(appSession.userId, conversationId)
    if (!owns) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
    }

    // Idempotency: the same conversation escalates to a single ticket for this user.
    const existing = await getPrisma().supportTicket.findFirst({
      where: { conversationRef: conversationId, userId: appSession.userId },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ reference: existing.id }, { status: 200 })
    }

    const actor: Actor = resolveRole({ authenticated: true, role: appSession.role, userId: appSession.userId })
    let reference: string
    try {
      reference = await makePorts(actor).escalation.escalate(
        'USER_REQUEST',
        'general',
        'normal',
        'ESCALATED_GENERIC',
        conversationId,
        redactedNote ?? undefined,
      )
    } catch {
      // Another request may have created the ticket concurrently (conversationRef is unique).
      const fallback = await getPrisma().supportTicket.findFirst({
        where: { conversationRef: conversationId, userId: appSession.userId },
        select: { id: true },
      })
      if (fallback) {
        return NextResponse.json({ reference: fallback.id }, { status: 200 })
      }
      throw new Error('escalate failed')
    }

    return NextResponse.json({ reference }, { status: 200 })
  } catch (error) {
    const requestId = generateRequestId()
    console.error('[SupportAI v2 escalate] Error:', { requestId, name: error instanceof Error ? error.name : 'UnknownError' })
    return NextResponse.json({ error: 'Internal server error. Please try again later.' }, { status: 500 })
  }
}
