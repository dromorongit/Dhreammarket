import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeUserContent } from '@/lib/sanitize'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

async function getGuestToken(request: NextRequest): Promise<{ token: string | null; isNew: boolean }> {
  const guestToken = request.cookies.get('support_guest_token')?.value || null
  if (guestToken) return { token: guestToken, isNew: false }
  const newToken = randomBytes(32).toString('hex')
  return { token: newToken, isNew: true }
}

function setGuestTokenCookie(response: NextResponse, token: string) {
  response.cookies.set('support_guest_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
}

async function getAuthenticatedUser(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  const { verifyToken } = await import('@/lib/auth-middleware')
  const payload = await verifyToken(token)
  if (!payload) return null
  return { userId: payload.userId, role: payload.role }
}

async function createConversationForTicket(ticketId: string, customerType: 'GUEST' | 'CUSTOMER', userId?: string, guestToken?: string) {
  const prisma = getPrisma()
  const conversationRef = randomBytes(16).toString('hex')
  await prisma.supportConversation.create({
    data: {
      ticketId,
      conversationRef,
      guestToken: customerType === 'GUEST' ? guestToken : null,
      customerType,
      assignedAdminId: null,
      status: 'OPEN',
      isReadByCustomer: false,
      isReadByAdmin: false,
    },
  })
  return conversationRef
}

// GET /api/support/conversations
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request)
    const { token: guestToken, isNew } = authUser ? { token: null, isNew: false } : await getGuestToken(request)

    const prisma = getPrisma()
    let conversations: any[] = []

    if (authUser) {
      conversations = await prisma.supportConversation.findMany({
        where: { customerType: 'CUSTOMER', assignedAdminId: null, ticket: { userId: authUser.userId } },
        include: {
          ticket: { select: { id: true, subject: true, status: true, type: true, priority: true, createdAt: true, updatedAt: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    } else if (guestToken) {
      conversations = await prisma.supportConversation.findMany({
        where: { customerType: 'GUEST', guestToken },
        include: {
          ticket: { select: { id: true, subject: true, status: true, type: true, priority: true, createdAt: true, updatedAt: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    }

    const result = conversations.map((c) => ({
      id: c.id,
      conversationRef: c.conversationRef,
      status: c.status,
      customerType: c.customerType,
      lastMessageAt: c.lastMessageAt,
      isReadByCustomer: c.isReadByCustomer,
      isReadByAdmin: c.isReadByAdmin,
      ticket: c.ticket,
    }))

    const response = NextResponse.json({ conversations: result })
    if (!authUser && isNew && guestToken) {
      setGuestTokenCookie(response, guestToken)
    }
    return response
  } catch (error) {
    console.error('Error fetching support conversations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/support/conversations
export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('support-ticket')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const authUser = await getAuthenticatedUser(request)
    const { token: guestToken, isNew } = authUser ? { token: null, isNew: false } : await getGuestToken(request)

    if (!authUser && !guestToken) {
      return NextResponse.json({ error: 'Unable to identify session' }, { status: 400 })
    }

    const { message, subject, type } = await request.json()

    if (!message || !subject || !type) {
      const response = NextResponse.json(
        { error: 'Message, subject, and type are required' },
        { status: 400 }
      )
      if (!authUser && isNew && guestToken) {
        setGuestTokenCookie(response, guestToken)
      }
      return response
    }

    const sanitizedSubject = sanitizeUserContent(subject, { maxLength: 200 })
    const sanitizedMessage = sanitizeUserContent(message, { maxLength: 5000 })

    if (sanitizedSubject.length < 2) {
      const response = NextResponse.json({ error: 'Subject must be at least 2 characters' }, { status: 400 })
      if (!authUser && isNew && guestToken) {
        setGuestTokenCookie(response, guestToken)
      }
      return response
    }
    if (sanitizedMessage.length < 1) {
      const response = NextResponse.json({ error: 'Message must not be empty' }, { status: 400 })
      if (!authUser && isNew && guestToken) {
        setGuestTokenCookie(response, guestToken)
      }
      return response
    }

    const validTypes = ['GENERAL', 'PAYMENT', 'ORDER', 'VENDOR', 'ACCOUNT', 'TECHNICAL', 'REPORT']
    if (!validTypes.includes(type)) {
      const response = NextResponse.json({ error: 'Invalid ticket type' }, { status: 400 })
      if (!authUser && isNew && guestToken) {
        setGuestTokenCookie(response, guestToken)
      }
      return response
    }

    const prisma = getPrisma()

    const existingConversation = await prisma.supportConversation.findFirst({
      where: authUser
        ? {
            customerType: 'CUSTOMER',
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            ticket: { userId: authUser.userId },
          }
        : {
            customerType: 'GUEST',
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            guestToken: guestToken || undefined,
          },
      include: {
        ticket: {
          select: {
            id: true,
            subject: true,
            message: true,
            type: true,
            status: true,
            priority: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    })

    if (existingConversation) {
      const response = NextResponse.json(
        {
          message: 'Conversation already in progress',
          ticket: existingConversation.ticket,
          conversationRef: existingConversation.conversationRef,
          customerType: existingConversation.customerType,
        },
        { status: 200 }
      )
      if (!authUser && isNew && guestToken) {
        setGuestTokenCookie(response, guestToken)
      }
      return response
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: authUser?.userId || null,
        subject: sanitizedSubject,
        message: sanitizedMessage,
        type: type as any,
        priority: 'MEDIUM',
        status: 'OPEN',
      },
      select: { id: true, subject: true, message: true, type: true, status: true, priority: true, createdAt: true, updatedAt: true },
    })

    const customerType = authUser ? 'CUSTOMER' : 'GUEST'
    const conversationRef = await createConversationForTicket(ticket.id, customerType, authUser?.userId, guestToken || undefined)

    if (!authUser) {
      const response = NextResponse.json(
        { message: 'Conversation created successfully', ticket, conversationRef, customerType },
        { status: 201 }
      )
      setGuestTokenCookie(response, guestToken!)
      return response
    }

    return NextResponse.json(
      { message: 'Conversation created successfully', ticket, conversationRef, customerType },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating support conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
