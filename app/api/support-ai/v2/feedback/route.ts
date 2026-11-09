import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { getServerSession } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit-log'

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export async function POST(request: NextRequest) {
  // Rate limited like support-ai-chat.
  const rateLimitCheck = rateLimit('support-ai-chat')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  let appSession: { userId: string; role: string; sessionId: string } | null = null
  try {
    appSession = await getServerSession()
  } catch {
    appSession = null
  }
  const userId = appSession?.userId ?? null

  try {
    const body = (await request.json()) ?? {}
    const { conversationId, traceId, helpful, reason } = body

    if (typeof conversationId !== 'string' || conversationId.trim().length === 0) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
    }
    if (typeof traceId !== 'string' || traceId.trim().length === 0) {
      return NextResponse.json({ error: 'traceId is required' }, { status: 400 })
    }
    if (typeof helpful !== 'boolean') {
      return NextResponse.json({ error: 'helpful must be a boolean' }, { status: 400 })
    }
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
      return NextResponse.json({ error: 'reason must be a string of 500 characters or fewer' }, { status: 400 })
    }

    await getPrisma().supportFeedback.create({
      data: {
        conversationId: conversationId.trim(),
        traceId: traceId.trim(),
        helpful,
        reason: reason ?? null,
        userId: userId ?? undefined,
      },
    })

    if (userId) {
      void createAuditLog({
        userId,
        userRole: appSession!.role,
        action: 'SUPPORT_FEEDBACK_RECEIVED',
        entityType: 'SYSTEM',
        entityId: traceId.trim(),
        afterData: { conversationId: conversationId.trim(), helpful },
      })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    const requestId = generateRequestId()
    console.error('[SupportAI v2 feedback] Error:', { requestId, name: error instanceof Error ? error.name : 'UnknownError' })
    return NextResponse.json({ error: 'Internal server error. Please try again later.' }, { status: 500 })
  }
}
