import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeUserContent } from '@/lib/sanitize'
import { sendEmail, getEmailTemplate, getSupportEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin can see all feedback, users can see their own
    const whereClause = payload.role === 'ADMIN' ? {} : { userId: payload.userId }

    const feedbacks = await getPrisma().feedback.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ feedbacks })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting - security hardening
  const rateLimitCheck = rateLimit('contact-form')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const token = request.cookies.get('token')?.value
    let userId: string | null = null

    // Try to get authenticated user (optional - allow anonymous submissions)
    if (token) {
      const payload = await verifyToken(token)
      if (payload) {
        userId = payload.userId
      }
    }

    const { type, subject, message, email: providedEmail, name: providedName } = await request.json()

    // Validate required fields
    if (!type || !subject || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // For anonymous submissions, email is required
    if (!userId && !providedEmail) {
      return NextResponse.json({ error: 'Email is required for anonymous submissions' }, { status: 400 })
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

    // Build feedback data
    const feedbackData: any = {
      type,
      subject: sanitizedSubject,
      message: sanitizedMessage,
      status: 'OPEN',
    }

    // Link to user if authenticated, otherwise store contact info in message
    if (userId) {
      feedbackData.userId = userId
    }

    const feedback = await getPrisma().feedback.create({
      data: feedbackData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    })

    // Send email notification to support (non-blocking)
    try {
      const userEmail = feedback.user?.email || providedEmail || 'Unknown'
      const userName = providedName || feedback.user?.email?.split('@')[0] || 'Anonymous User'
      const supportEmail = await getSupportEmail()
      
      const escapedMessage = sanitizedMessage
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
      
      const submissionTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
      
      const emailContent = `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">New Support Submission</h2>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">A new support message has been submitted.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Source</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">Contact Page</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Name</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${userName}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Email</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${userEmail}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Feedback Type</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${type.replace(/_/g, ' ')}</td>
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
        subject: `[${type}] ${sanitizedSubject}`,
        htmlContent: await getEmailTemplate(emailContent, 'You can reply directly to this email to respond to the user.'),
        textContent: `New Contact Page submission\n\nSource: Contact Page\nName: ${userName}\nEmail: ${userEmail}\nType: ${type}\nSubject: ${sanitizedSubject}\nSubmitted: ${submissionTimestamp}\n\nMessage:\n${sanitizedMessage}`,
        replyTo: userEmail,
      })

      if (!emailResult.success) {
        console.error('[FEEDBACK] Email send failed:', emailResult.error || emailResult.reason)
      }
    } catch (emailError) {
      console.error('[FEEDBACK] Email send error:', emailError)
    }

    return NextResponse.json({ feedback }, { status: 201 })
  } catch (error) {
    console.error('Error submitting feedback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
