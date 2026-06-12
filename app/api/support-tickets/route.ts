import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { SupportTicketType, SupportTicketStatus, SupportTicketPriority } from '@prisma/client'

export async function POST(request: NextRequest) {
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

    if (subject.length < 5) {
      return NextResponse.json({ error: 'Subject must be at least 5 characters' }, { status: 400 })
    }

    if (message.length < 10) {
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
      subject: subject.trim(),
      message: message.trim(),
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

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    console.error('Error creating support ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}