import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { createNotification } from '@/lib/notifications'

// PATCH /api/admin/support/[id] - Update ticket status and add admin reply
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAdmin()
    if (auth instanceof NextResponse) {
      return auth
    }

    const { id } = await params
    const { status, priority, adminReply } = await request.json()

    // Verify ticket exists
    const existingTicket = await getPrisma().supportTicket.findUnique({
      where: { id },
    })

    if (!existingTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (status) updateData.status = status
    if (priority) updateData.priority = priority
    if (adminReply !== undefined) updateData.adminReply = adminReply

    // Update the ticket
    const ticket = await getPrisma().supportTicket.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        subject: true,
        message: true,
        type: true,
        status: true,
        priority: true,
        adminReply: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    // Create notification for the user
    let notificationTitle = 'Support Ticket Updated'
    let notificationMessage = ''

    if (status && status !== existingTicket.status) {
      notificationMessage = `Your support ticket "${existingTicket.subject}" status has been updated to ${status}.`
      await createNotification(
        ticket.user.id,
        'SUPPORT_TICKET_STATUS_UPDATED',
        notificationTitle,
        notificationMessage
      )
    }

    if (adminReply && adminReply !== existingTicket.adminReply) {
      notificationMessage = `Admin has replied to your support ticket: "${existingTicket.subject}"`
      await createNotification(
        ticket.user.id,
        'SUPPORT_TICKET_REPLIED',
        'Admin Reply Received',
        notificationMessage
      )
    }

    return NextResponse.json({ message: 'Ticket updated successfully', ticket })
  } catch (error) {
    console.error('Error updating support ticket:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
