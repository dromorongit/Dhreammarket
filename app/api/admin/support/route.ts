import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET /api/admin/support - Fetch all support tickets with filtering
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof NextResponse) {
      return auth
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')
    const userId = searchParams.get('userId')
    const search = searchParams.get('search')

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
