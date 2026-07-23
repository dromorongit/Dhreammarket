import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getPrisma().user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const result = await getPrisma().session.updateMany({
      where: { userId: payload.userId, isExpired: false, sessionId: { not: payload.sessionId } },
      data: {
        isExpired: true,
        expiredAt: new Date(),
      },
    })

    const total = result.count

    if (total === 0) {
      return NextResponse.json({ message: 'No other active sessions to log out from.' })
    }

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role || 'USER',
      action: 'LOGOUT_ALL_DEVICES',
      entityType: 'USER',
      entityId: payload.userId,
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ message: `Logged out from ${total} device(s) successfully` })
  } catch (error) {
    console.error('Error logging out from all devices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
