import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { SupportTicketStatus, SupportTicketType } from '@prisma/client'
import { createNotification } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeUserContent } from '@/lib/sanitize'

// GET /api/support - Fetch user's support tickets
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = { userId: payload.userId, role: payload.role }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    const validStatuses = Object.values(SupportTicketStatus)
    const validTypes = Object.values(SupportTicketType)

    if (status && !validStatuses.includes(status as SupportTicketStatus)) {
      return NextResponse.json({ error: 'Invalid ticket status' }, { status: 400 })
    }
    if (type && !validTypes.includes(type as SupportTicketType)) {
      return NextResponse.json({ error: 'Invalid ticket type' }, { status: 400 })
    }

    const whereClause: any = { userId: user.userId }
    if (status) whereClause.status = status
    if (type) whereClause.type = type

    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const skip = (page - 1) * limit

    const [tickets, total] = await Promise.all([
      getPrisma().supportTicket.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          subject: true,
          message: true,
          type: true,
          status: true,
          priority: true,
          adminReply: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      getPrisma().supportTicket.count({ where: whereClause }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({ tickets, pagination: { page, limit, total, totalPages } })
  } catch (error) {
    console.error('Error fetching support tickets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/support - Create a new support ticket
export async function POST(request: NextRequest) {
  // Rate limiting - security hardening
  const rateLimitCheck = rateLimit('support-ticket')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = { userId: payload.userId, role: payload.role }

    const { subject, message, type, priority } = await request.json()

    if (!subject || !message || !type) {
      return NextResponse.json(
        { error: 'Subject, message, and type are required' },
        { status: 400 }
      )
    }

    // Input sanitization - security hardening
    const sanitizedSubject = sanitizeUserContent(subject, { maxLength: 200 })
    const sanitizedMessage = sanitizeUserContent(message, { maxLength: 5000 })

    if (sanitizedSubject.length < 5) {
      return NextResponse.json({ error: 'Subject must be at least 5 characters' }, { status: 400 })
    }

    if (sanitizedMessage.length < 10) {
      return NextResponse.json({ error: 'Message must be at least 10 characters' }, { status: 400 })
    }

    const validTypes = ['GENERAL', 'PAYMENT', 'ORDER', 'VENDOR', 'ACCOUNT', 'TECHNICAL', 'REPORT']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid ticket type' }, { status: 400 })
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    }

    // Create the ticket
    const ticket = await getPrisma().supportTicket.create({
      data: {
        userId: user.userId,
        subject: sanitizedSubject,
        message: sanitizedMessage,
        type: type as any,
        priority: (priority as any) || 'MEDIUM',
      },
      select: {
        id: true,
        subject: true,
        message: true,
        type: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    })

    // Create notification for admins (all admin users)
    const adminUsers = await getPrisma().user.findMany({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] }
      },
      select: { id: true }
    })

    for (const admin of adminUsers) {
      await createNotification(
        admin.id,
        'SUPPORT_TICKET_CREATED',
        'New Support Ticket',
        `A new support ticket has been submitted: "${sanitizedSubject}"`
      )
    }

    return NextResponse.json(
      { message: 'Support ticket created successfully', ticket },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating support ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
