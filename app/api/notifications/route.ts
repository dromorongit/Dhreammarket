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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const skip = (page - 1) * limit

    const [notifications, total, unreadCount] = await Promise.all([
      getPrisma().notification.findMany({
        where: { userId: payload.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      getPrisma().notification.count({ where: { userId: payload.userId } }),
      getPrisma().notification.count({ where: { userId: payload.userId, isRead: false } }),
    ])

    return NextResponse.json({
      notifications,
      unreadCount,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
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
      // Mark all notifications as read
      await getPrisma().notification.updateMany({
        where: { userId: payload.userId, isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ message: 'All notifications marked as read' })
    }

    if (notificationId) {
      // Mark specific notification as read
      const notification = await getPrisma().notification.findFirst({
        where: { id: notificationId, userId: payload.userId },
      })

      if (!notification) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }

      await getPrisma().notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      })
      return NextResponse.json({ message: 'Notification marked as read' })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Error updating notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}