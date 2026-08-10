import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/support/tickets/[id]/stream
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = requireAdmin()
    if (adminUser instanceof NextResponse) {
      return adminUser
    }

    const { id } = await params
    const prisma = getPrisma()
    const ticket = await prisma.supportTicket.findUnique({ where: { id } })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
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

        const pollInterval = setInterval(async () => {
          if (isCancelled) return
          try {
            const lastMessage = await prisma.supportMessage.findFirst({
              where: { ticketId: id, senderType: { not: 'CUSTOMER' } },
              orderBy: { createdAt: 'desc' },
              select: { id: true, createdAt: true },
            })

            const conversation = await prisma.supportConversation.findFirst({
              where: { ticketId: id },
              select: { status: true, isReadByAdmin: true, lastMessageAt: true },
            })

            if (lastMessage) {
              sendEvent({ type: 'activity', lastMessageAt: lastMessage.createdAt })
            }
            if (conversation) {
              sendEvent({ type: 'status', status: conversation.status, isReadByAdmin: conversation.isReadByAdmin })
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
  } catch (error) {
    console.error('Error in admin stream:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
