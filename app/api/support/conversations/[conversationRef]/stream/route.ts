import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getGuestToken(request: NextRequest): Promise<string | null> {
  return request.cookies.get('support_guest_token')?.value || null
}

async function resolveConversation(request: NextRequest, conversationRef: string) {
  const prisma = getPrisma()
  const token = request.cookies.get('token')?.value
  const guestToken = await getGuestToken(request)

  let authUser: { userId: string; role: string } | null = null
  if (token) {
    const payload = await verifyToken(token)
    if (payload) authUser = { userId: payload.userId, role: payload.role }
  }

  const conversation = await prisma.supportConversation.findUnique({
    where: { conversationRef },
    include: { ticket: true },
  })

  if (!conversation) {
    console.error(`[support stream] resolveConversation failed: no conversation found for ref=${conversationRef}`)
    return null
  }

  if (authUser) {
    if (conversation.customerType !== 'CUSTOMER') {
      console.error(`[support stream] resolveConversation failed: customerType mismatch (expected CUSTOMER, got ${conversation.customerType}) for ref=${conversationRef}`)
      return null
    }
    if (conversation.ticket.userId !== authUser.userId) {
      console.error(`[support stream] resolveConversation failed: userId mismatch (ticket.userId=${conversation.ticket.userId}, authUser.userId=${authUser.userId}) for ref=${conversationRef}`)
      return null
    }
    return { conversation, role: 'CUSTOMER' }
  }

  if (guestToken && conversation.customerType === 'GUEST' && conversation.guestToken === guestToken) {
    return { conversation, role: 'GUEST' }
  }

  if (!guestToken) {
    console.error(`[support stream] resolveConversation failed: no guestToken cookie present for GUEST conversation ref=${conversationRef}`)
  } else if (conversation.customerType !== 'GUEST') {
    console.error(`[support stream] resolveConversation failed: guestToken present but conversation is ${conversation.customerType} (not GUEST) for ref=${conversationRef}`)
  } else {
    console.error(`[support stream] resolveConversation failed: guestToken mismatch for ref=${conversationRef}`)
  }

  return null
}

// GET /api/support/conversations/[conversationRef]/stream
export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationRef: string }> }) {
  const { conversationRef } = await params
  const resolved = await resolveConversation(request, conversationRef)
  if (!resolved) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const prisma = getPrisma()
  const ticketId = resolved.conversation.ticketId

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

      const pollInterval = setInterval(async () => {
        if (isCancelled) return
        try {
          const lastMessage = await prisma.supportMessage.findFirst({
            where: { ticketId, senderType: { not: resolved.role === 'CUSTOMER' ? 'CUSTOMER' : 'GUEST' } },
            orderBy: { createdAt: 'desc' },
            select: { id: true, createdAt: true },
          })

          const conversation = await prisma.supportConversation.findUnique({
            where: { id: resolved.conversation.id },
            select: { status: true, isReadByCustomer: true, lastMessageAt: true },
          })

          if (lastMessage) {
            sendEvent({ type: 'activity', lastMessageAt: lastMessage.createdAt })
          }
          if (conversation) {
            sendEvent({ type: 'status', status: conversation.status, isReadByCustomer: conversation.isReadByCustomer })
          }
        } catch {
          // ignore poll errors
        }
      }, 3000)

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
}
