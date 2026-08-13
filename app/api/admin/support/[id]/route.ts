import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { createNotification } from '@/lib/notifications'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'

// PATCH /api/admin/support/[id] - Update ticket status and add admin reply
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin()
    if (adminUser instanceof NextResponse) {
      return adminUser
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

    // Create audit log for support ticket update
    const { beforeData, afterData } = captureBeforeAfter(
      { status: existingTicket.status, priority: existingTicket.priority, adminReply: existingTicket.adminReply },
      { status: ticket.status, priority: ticket.priority, adminReply: ticket.adminReply }
    )

    if (beforeData !== afterData) {
      await createAuditLog({
        userId: adminUser.userId,
        userRole: adminUser.role,
        action: 'SUPPORT_TICKET_UPDATED',
        entityType: 'SUPPORT_TICKET',
        entityId: id,
        beforeData,
        afterData,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
      })
    }

    // Create notification for the user (only if user exists)
    if (ticket.user && status && status !== existingTicket.status) {
      const notificationMessage = `Your support ticket "${existingTicket.subject}" status has been updated to ${status}.`
      await createNotification(
        ticket.user.id,
        'SUPPORT_TICKET_STATUS_UPDATED',
        'Support Ticket Updated',
        notificationMessage
      )
    }

    if (ticket.user && adminReply && adminReply !== existingTicket.adminReply) {
      const notificationMessage = `Admin has replied to your support ticket: "${existingTicket.subject}"`
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
