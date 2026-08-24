import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { sanitizeUserContent } from '@/lib/sanitize'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/support/[id]/messages
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAdmin()
    if (adminUser instanceof NextResponse) {
      return adminUser
    }

    const { id } = await params
    const prisma = getPrisma()

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const messages = await prisma.supportMessage.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        senderType: true,
        senderId: true,
        senderName: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error fetching admin messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/support/[id]/messages
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimitCheck = rateLimit('admin-support-message')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const adminUser = await requireAdmin()
    if (adminUser instanceof NextResponse) {
      return adminUser
    }

    const { id } = await params
    const { message } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const sanitizedMessage = sanitizeUserContent(message, { maxLength: 5000 })
    if (sanitizedMessage.length === 0) {
      return NextResponse.json({ error: 'Message must not be empty' }, { status: 400 })
    }

    const prisma = getPrisma()
    const ticket = await prisma.supportTicket.findUnique({ where: { id } })
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const senderType = adminUser.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN'

    const adminWithName = await prisma.user.findUnique({
      where: { id: adminUser.userId },
      select: {
        email: true,
        profile: { select: { firstName: true, lastName: true } },
      },
    })

    let senderName: string | null = null
    if (adminWithName) {
      const firstName = adminWithName.profile?.firstName
      const lastName = adminWithName.profile?.lastName
      if (firstName || lastName) {
        senderName = `${firstName || ''} ${lastName || ''}`.trim()
      } else {
        senderName = adminWithName.email.split('@')[0]
      }
    }

    const supportMessage = await prisma.supportMessage.create({
      data: {
        ticketId: id,
        senderType,
        senderId: adminUser.userId,
        senderName,
        message: sanitizedMessage,
        isRead: false,
      },
      select: {
        id: true,
        senderType: true,
        senderId: true,
        senderName: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    })

    console.log('[ADMIN SUPPORT MESSAGE]', JSON.stringify({
      ticketId: id,
      messageId: supportMessage.id,
      senderType: supportMessage.senderType,
      timestamp: supportMessage.createdAt,
    }))

    const newStatus = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? 'OPEN' : ticket.status
    await prisma.supportTicket.update({
      where: { id },
      data: {
        status: newStatus as any,
        updatedAt: new Date(),
      },
    })

    await prisma.supportConversation.updateMany({
      where: { ticketId: id },
      data: {
        lastMessageAt: new Date(),
        isReadByCustomer: false,
        status: newStatus,
        assignedAdminId: adminUser.userId,
      },
    })

    if (ticket.userId) {
      const { createNotification } = await import('@/lib/notifications')
      await createNotification(
        ticket.userId,
        'SUPPORT_TICKET_REPLIED',
        'Admin Reply Received',
        `Admin has replied to your support ticket: "${ticket.subject}"`
      )
    }

    return NextResponse.json({ message: supportMessage }, { status: 201 })
  } catch (error) {
    console.error('Error sending admin message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
