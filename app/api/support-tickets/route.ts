import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { SupportTicketType, SupportTicketStatus, SupportTicketPriority } from '@prisma/client'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeUserContent } from '@/lib/sanitize'
import { createAuditLog } from '@/lib/audit-log'
import { sendEmail, getEmailTemplate, getSupportEmail } from '@/lib/email'

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

// Send email notification to support
    try {
      let fromName = name || email || 'Unknown'
      let userEmail = email || 'Unknown'
      if (userId && !name) {
        const userRecord = await getPrisma().user.findUnique({ where: { id: userId } })
        fromName = userRecord?.email || email || 'Unknown'
      }
      if (userId && !email) {
        const userRecord = await getPrisma().user.findUnique({ where: { id: userId } })
        userEmail = userRecord?.email || 'Unknown'
      }
      
      const escapedMessage = sanitizedMessage
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
      
      const submissionTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
      const feedbackType = category || 'General'
      const supportEmail = await getSupportEmail()
      
      const emailContent = `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">New Support Submission</h2>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">A new support message has been submitted.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Source</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">Help Center</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Name</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${fromName}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Email</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${userEmail}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Feedback Type</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${feedbackType}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Subject</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${sanitizedSubject}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Submitted</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${submissionTimestamp}</td>
          </tr>
        </table>
        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1a1a2e;">Message</h3>
        <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6;">${escapedMessage}</p>
      `

      const emailResult = await sendEmail({
        to: supportEmail,
        subject: `[${feedbackType}] ${sanitizedSubject}`,
        htmlContent: await getEmailTemplate(emailContent, 'You can reply directly to this email to respond to the user.'),
        textContent: `New Help Center Contact Support submission\n\nSource: Help Center\nName: ${fromName}\nEmail: ${userEmail}\nFeedback Type: ${feedbackType}\nSubject: ${sanitizedSubject}\nSubmitted: ${submissionTimestamp}\n\nMessage:\n${sanitizedMessage}`,
        replyTo: userEmail,
      })

      if (!emailResult.success) {
        console.error('[SUPPORT-TICKET] Email send failed:', emailResult.error || emailResult.reason)
      }
    } catch (emailError) {
      console.error('[SUPPORT-TICKET] Email send error:', emailError)
    }

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    console.error('Error creating support ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}