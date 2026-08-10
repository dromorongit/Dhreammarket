import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeUserContent } from '@/lib/sanitize'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

async function getGuestToken(request: NextRequest): Promise<string | null> {
  const guestToken = request.cookies.get('support_guest_token')?.value || null
  if (guestToken) return guestToken
  const newToken = randomBytes(32).toString('hex')
  const response = NextResponse.next()
  response.cookies.set('support_guest_token', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return newToken
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
    const guestToken = authUser ? null : await getGuestToken(request)

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

    return NextResponse.json({ conversations: result })
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
    const guestToken = authUser ? null : await getGuestToken(request)

    if (!authUser && !guestToken) {
      return NextResponse.json({ error: 'Unable to identify session' }, { status: 400 })
    }

    const { message, subject, type } = await request.json()

    if (!message || !subject || !type) {
      return NextResponse.json(
        { error: 'Message, subject, and type are required' },
        { status: 400 }
      )
    }

    const sanitizedSubject = sanitizeUserContent(subject, { maxLength: 200 })
    const sanitizedMessage = sanitizeUserContent(message, { maxLength: 5000 })

    if (sanitizedSubject.length < 2) {
      return NextResponse.json({ error: 'Subject must be at least 2 characters' }, { status: 400 })
    }
    if (sanitizedMessage.length < 1) {
      return NextResponse.json({ error: 'Message must not be empty' }, { status: 400 })
    }

    const validTypes = ['GENERAL', 'PAYMENT', 'ORDER', 'VENDOR', 'ACCOUNT', 'TECHNICAL', 'REPORT']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid ticket type' }, { status: 400 })
    }

    const prisma = getPrisma()

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
      if (guestToken) {
        response.cookies.set('support_guest_token', guestToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365,
          path: '/',
        })
      }
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
