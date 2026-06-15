import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { SupportTicketType, SupportTicketStatus, SupportTicketPriority } from '@prisma/client'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeUserContent } from '@/lib/sanitize'
import { createAuditLog } from '@/lib/audit-log'

export async function POST(request: NextRequest) {
  // Rate limiting - security hardening
  const rateLimitCheck = rateLimit('support-ticket')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const token = request.cookies.get('token')?.value
    let userId: string | null = null

    // Try to get authenticated user
    if (token) {
      const payload = await verifyToken(token)
      if (payload) {
        userId = payload.userId
      }
    }

    const { name, email, phone, subject, category, message } = await request.json()

    // Validate required fields
    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
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

    const ticketTypeMap: Record<string, SupportTicketType> = {
      'Orders': 'ORDER',
      'Payments': 'PAYMENT',
      'Verification': 'GENERAL',
      'Vendor Support': 'VENDOR',
      'Technical Issues': 'TECHNICAL',
      'Refunds': 'GENERAL',
      'Other': 'GENERAL'
    }

    // Build ticket data - include userId if authenticated, otherwise store contact info in message
    const ticketData: any = {
      subject: sanitizedSubject,
      message: sanitizedMessage,
      type: ticketTypeMap[category] || 'GENERAL',
      status: 'OPEN',
      priority: 'MEDIUM',
    }

    // Only link to user if authenticated
    if (userId) {
      ticketData.userId = userId
    }

    const ticket = await getPrisma().supportTicket.create({
      data: ticketData,
    })

    // Create audit log for support ticket creation
    if (userId) {
      const userRecord = await getPrisma().user.findUnique({ where: { id: userId } })
      await createAuditLog({
        userId: userId,
        userRole: userRecord?.role || 'CUSTOMER',
        action: 'SUPPORT_TICKET_CREATED',
        entityType: 'SUPPORT_TICKET',
        entityId: ticket.id,
        afterData: {
          subject: ticket.subject,
          type: ticket.type,
          status: ticket.status,
        },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
      })
    }

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    console.error('Error creating support ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}