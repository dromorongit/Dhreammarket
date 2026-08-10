import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { sanitizeUserContent } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/admin/support/tickets/[id]/messages
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = requireAdmin()
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

    const supportMessage = await prisma.supportMessage.create({
      data: {
        ticketId: id,
        senderType,
        senderId: adminUser.userId,
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
