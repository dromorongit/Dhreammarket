import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET /api/admin/support - Fetch all support tickets with filtering
export async function GET(request: NextRequest) {
  console.log('[ADMIN SUPPORT] GET request started')
  try {
    const auth = await requireAdmin()
    console.log('[ADMIN SUPPORT] Auth check result:', auth instanceof NextResponse ? `response ${auth.status}` : 'authorized')
    if (auth instanceof NextResponse) {
      console.log('[ADMIN SUPPORT] Auth check returned error response:', auth.status)
      return auth
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')
    const userId = searchParams.get('userId')
    const search = searchParams.get('search')
    console.log('[ADMIN SUPPORT] Query params:', { status, type, priority, userId, search })

    const whereClause: any = {}

    if (status) whereClause.status = status
    if (type) whereClause.type = type
    if (priority) whereClause.priority = priority
    if (userId) whereClause.userId = userId
    if (search) {
      whereClause.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ]
    }

    console.log('[ADMIN SUPPORT] Query: prisma.supportTicket.findMany')
    const tickets = await getPrisma().supportTicket.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
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
        conversationRef: true,
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })

    // Transform to handle nullable user
    const transformedTickets = tickets.map(ticket => ({
      ...ticket,
      user: ticket.user || undefined
    }))

    // Get counts by status
    console.log('[ADMIN SUPPORT] Query: prisma.supportTicket.groupBy')
    const counts = await getPrisma().supportTicket.groupBy({
      by: ['status'],
      _count: { id: true },
    })

    const statusCounts = counts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({ tickets: transformedTickets, statusCounts })
  } catch (error) {
    console.error('[ADMIN SUPPORT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
