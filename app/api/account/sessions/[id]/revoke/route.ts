import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await getPrisma().session.findUnique({
      where: { sessionId: params.id },
    })

    if (!session || session.userId !== payload.userId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.isExpired) {
      return NextResponse.json({ error: 'Session is already revoked' }, { status: 400 })
    }

    await getPrisma().session.update({
      where: { sessionId: params.id },
      data: {
        isExpired: true,
        expiredAt: new Date(),
      },
    })

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'SESSION_REVOKED',
      entityType: 'SESSION',
      entityId: session.id,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ message: 'Session revoked successfully' })
  } catch (error) {
    console.error('Error revoking session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
