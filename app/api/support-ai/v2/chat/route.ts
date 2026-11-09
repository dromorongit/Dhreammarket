import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { getServerSession } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { handleSupportMessage } from '@/lib/support-ai-v2/src/pipeline/handle-message'
import { resolveRole } from '@/lib/support-ai-v2/src/identity/resolve-role'
import { makePorts } from '@/lib/support-ai-v2/ports'
import type { Actor, Session } from '@/lib/support-ai-v2/src/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HUMAN_SUPPORT_FALLBACK_MESSAGE =
  'Support AI is temporarily unavailable. Please contact our human support team by email or WhatsApp, or visit your Dashboard > Help.'

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function sanitizeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: '[REDACTED]' }
  }
  return { name: 'UnknownError', message: '[REDACTED]' }
}

/** Kill switch: env override is hard, otherwise the SuperAdminSettings flag (default off). */
async function supportAiV2Enabled(): Promise<boolean> {
  const envOverride = process.env.SUPPORT_AI_V2_ENABLED
  if (envOverride !== undefined && envOverride !== '') {
    return envOverride.trim().toLowerCase() === 'true'
  }
  try {
    const settings = await getPrisma().superAdminSettings.findFirst()
    return settings?.supportAiV2Enabled === true
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  // 1. Kill switch -- never call retrieval when the feature is off.
  const enabled = await supportAiV2Enabled()
  if (!enabled) {
    return NextResponse.json(
      {
        action: 'ESCALATE',
        message: HUMAN_SUPPORT_FALLBACK_MESSAGE,
        reasonCode: 'SYSTEM_ERROR',
        traceId: generateRequestId(),
      },
      { status: 200 },
    )
  }

  // 2. Rate limit (reuse the support-ai-chat config; IP-based until a session exists).
  const rateLimitCheck = rateLimit('support-ai-chat')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  // 3. Verify session via the existing auth helper.
  let appSession: { userId: string; role: string; sessionId: string } | null = null
  try {
    appSession = await getServerSession()
  } catch {
    appSession = null
  }
  if (!appSession) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const actor: Actor = resolveRole({
    authenticated: true,
    role: appSession.role,
    userId: appSession.userId,
  })
  const sessionPort = {
    getSession: (): Session => ({
      authenticated: true,
      role: appSession.role as Session['role'],
      userId: actor.userId,
    }),
  }

  try {
    const body = await request.json()
    const { message, conversationId } = body ?? {}

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string.' },
        { status: 400 },
      )
    }
    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Message must be 2000 characters or fewer.' },
        { status: 400 },
      )
    }

    const convId =
      typeof conversationId === 'string' && conversationId.length > 0 ? conversationId : generateRequestId()

    const result = await handleSupportMessage(
      { text: message.trim(), conversationId: convId },
      {
        session: sessionPort,
        ...makePorts(actor),
        clock: { now: () => Date.now() },
        ids: { generate: generateRequestId },
        loadHistory: () => [],
      },
    )

    return NextResponse.json(result)
  } catch (error) {
    const requestId = generateRequestId()
    const sanitized = sanitizeError(error)
    console.error('[SupportAI v2] Error:', { requestId, ...sanitized })
    return NextResponse.json(
      { error: 'Internal server error. Please try again later.' },
      { status: 500 },
    )
  }
}
