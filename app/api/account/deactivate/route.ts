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

    const user = await getPrisma().user.update({
      where: { id: payload.userId },
      data: { status: 'DISABLED' },
    })

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role || 'USER',
      action: 'ACCOUNT_DEACTIVATED',
      entityType: 'USER',
      entityId: payload.userId,
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ message: 'Account deactivated successfully' })
  } catch (error) {
    console.error('Error deactivating account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
