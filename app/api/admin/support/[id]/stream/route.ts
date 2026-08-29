import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/support/[id]/stream
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAdmin()
    if (adminUser instanceof NextResponse) {
      return adminUser
    }

    const { id } = await params
    const prisma = getPrisma()
    const ticket = await prisma.supportTicket.findUnique({ where: { id } })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const adminKey = `admin-support-stream:${adminUser.userId}`
    const adminRateLimit = checkRateLimit(adminKey, RATE_LIMIT_CONFIGS['admin-support-stream'])
    if (!adminRateLimit.success) {
      const response = NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          resetTime: new Date(adminRateLimit.resetTime!).toISOString(),
        },
        { status: 429 }
      )
      response.headers.set('X-RateLimit-Limit', String(adminRateLimit.limit))
      response.headers.set('X-RateLimit-Remaining', '0')
      response.headers.set('X-RateLimit-Reset', String(adminRateLimit.resetTime))
      response.headers.set('Retry-After', String(Math.ceil((adminRateLimit.resetTime! - Date.now()) / 1000)))
      return response
    }

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        let isCancelled = false

        const sendEvent = (data: Record<string, unknown>) => {
          if (isCancelled) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          } catch {
            // stream closed
          }
        }

      sendEvent({ type: 'connected' })

      let lastSeenMessageId: string | null = null

      const pollInterval = setInterval(async () => {
        if (isCancelled) return
        try {
          const lastMessage = await prisma.supportMessage.findFirst({
            where: { ticketId: id, senderType: { in: ['GUEST', 'CUSTOMER'] } },
            orderBy: { createdAt: 'desc' },
            select: { id: true, createdAt: true },
          })

          if (lastMessage && lastMessage.id !== lastSeenMessageId) {
            lastSeenMessageId = lastMessage.id
            sendEvent({ type: 'activity', lastMessageAt: lastMessage.createdAt })
          }

          const conversation = await prisma.supportConversation.findFirst({
            where: { ticketId: id },
            select: { status: true, isReadByAdmin: true, lastMessageAt: true },
          })

          if (conversation) {
            sendEvent({ type: 'status', status: conversation.status, isReadByAdmin: conversation.isReadByAdmin })
          }
        } catch {
          // ignore poll errors
        }
      }, 1500)

        request.signal.addEventListener('abort', () => {
          isCancelled = true
          clearInterval(pollInterval)
          try {
            controller.close()
          } catch {
            // already closed
          }
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in admin stream:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
