import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/admin/support/cleanup-stale
export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin()
    if (adminUser instanceof NextResponse) {
      return adminUser
    }

    const prisma = getPrisma()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const staleConversations = await prisma.supportConversation.findMany({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        lastMessageAt: { lt: thirtyDaysAgo },
      },
      select: { id: true, ticketId: true },
    })

    const ticketIds = staleConversations.reduce((acc, c) => {
      if (!acc.includes(c.ticketId)) acc.push(c.ticketId)
      return acc
    }, [] as string[])

    const conversationResult = await prisma.supportConversation.updateMany({
      where: {
        id: { in: staleConversations.map((c) => c.id) },
      },
      data: { status: 'CLOSED' },
    })

    const ticketResult = await prisma.supportTicket.updateMany({
      where: {
        id: { in: ticketIds },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      data: { status: 'CLOSED', updatedAt: new Date() },
    })

    return NextResponse.json({
      message: 'Cleanup completed',
      closedConversations: conversationResult.count,
      closedTickets: ticketResult.count,
    })
  } catch (error) {
    console.error('Cleanup stale conversations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
