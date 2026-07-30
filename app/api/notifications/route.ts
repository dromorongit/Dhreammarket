import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

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

    const page = Math.max(parseInt(request.nextUrl.searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '20', 10), 1), 100)
    const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === 'true'

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { userId: payload.userId }
    if (unreadOnly) {
      where.isRead = false
    }

    const [notifications, total] = await Promise.all([
      getPrisma().notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      getPrisma().notification.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      notifications,
      unreadCount: unreadOnly ? total : undefined,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notificationId, markAllRead } = await request.json()

    if (markAllRead) {
      await getPrisma().notification.updateMany({
        where: { userId: payload.userId, isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true, updated: 'all' })
    }

    if (notificationId) {
      await getPrisma().notification.updateMany({
        where: { id: notificationId, userId: payload.userId },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true, updated: notificationId })
    }

    return NextResponse.json({ error: 'notificationId or markAllRead required' }, { status: 400 })
  } catch (error) {
    console.error('Error updating notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}