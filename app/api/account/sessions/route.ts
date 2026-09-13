import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = outcome

    const userSessions = await getPrisma().session.findMany({
      where: { userId: payload.userId },
      orderBy: { lastActivity: 'desc' },
    })

    const sessions = userSessions.map((session) => ({
      id: session.sessionId,
      device: session.device || 'Unknown Device',
      browser: session.browser || 'Unknown Browser',
      os: session.os || 'Unknown OS',
      ipAddress: session.ipAddress || 'Unknown IP',
      location: session.location || (session.ipAddress ? session.ipAddress : 'Unknown Location'),
      lastActive: session.lastActivity.toISOString(),
      createdAt: session.createdAt.toISOString(),
      current: session.sessionId === payload.sessionId,
      userAgent: session.userAgent || 'Unknown',
      isExpired: session.isExpired,
    }))

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
