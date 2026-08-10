import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { sanitizeUserContent } from '@/lib/sanitize'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  return { userId: payload.userId, role: payload.role }
}

async function getGuestToken(request: NextRequest): Promise<string | null> {
  return request.cookies.get('support_guest_token')?.value || null
}

async function resolveConversation(request: NextRequest, conversationRef: string) {
  const prisma = getPrisma()
  const authUser = await getAuthenticatedUser(request)
  const guestToken = authUser ? null : await getGuestToken(request)

  const conversation = await prisma.supportConversation.findUnique({
    where: { conversationRef },
    include: { ticket: true },
  })

  if (!conversation) return null

  if (authUser) {
    if (conversation.customerType !== 'CUSTOMER') return null
    if (conversation.ticket.userId !== authUser.userId) return null
    return { conversation, identity: { type: 'CUSTOMER', userId: authUser.userId } }
  }

  if (guestToken && conversation.customerType === 'GUEST' && conversation.guestToken === guestToken) {
    return { conversation, identity: { type: 'GUEST', guestToken } }
  }

  return null
}

// GET /api/support/conversations/[conversationRef]/messages
export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationRef: string }> }) {
  try {
    const { conversationRef } = await params
    const resolved = await resolveConversation(request, conversationRef)
    if (!resolved) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const prisma = getPrisma()
    const messages = await prisma.supportMessage.findMany({
      where: { ticketId: resolved.conversation.ticketId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        senderType: true,
        senderId: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    })

    await prisma.supportMessage.updateMany({
      where: { ticketId: resolved.conversation.ticketId, senderType: { not: 'CUSTOMER' }, isRead: false },
      data: { isRead: true },
    })

    await prisma.supportConversation.update({
      where: { id: resolved.conversation.id },
      data: { isReadByCustomer: true },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/support/conversations/[conversationRef]/messages
export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationRef: string }> }) {
  try {
    const resolved = await resolveConversation(request, (await params).conversationRef)
    if (!resolved) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const { message } = await request.json()
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const sanitizedMessage = sanitizeUserContent(message, { maxLength: 5000 })
    if (sanitizedMessage.length === 0) {
      return NextResponse.json({ error: 'Message must not be empty' }, { status: 400 })
    }

    const prisma = getPrisma()
    const supportMessage = await prisma.supportMessage.create({
      data: {
        ticketId: resolved.conversation.ticketId,
        senderType: resolved.identity.type as any,
        senderId: resolved.identity.type === 'CUSTOMER' ? resolved.identity.userId : null,
        message: sanitizedMessage,
        isRead: false,
      },
      select: {
        id: true,
        senderType: true,
        senderId: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    })

    await prisma.supportConversation.update({
      where: { id: resolved.conversation.id },
      data: {
        lastMessageAt: new Date(),
        isReadByAdmin: false,
        isReadByCustomer: resolved.identity.type === 'CUSTOMER',
        status: 'OPEN',
      },
    })

    await prisma.supportTicket.update({
      where: { id: resolved.conversation.ticketId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({ message: supportMessage }, { status: 201 })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
