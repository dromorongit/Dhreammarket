import { NextRequest, NextResponse } from 'next/server'
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

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role || 'USER',
      action: 'ACCOUNT_DELETE_REQUESTED',
      entityType: 'USER',
      entityId: payload.userId,
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ message: 'Account deletion is not yet available. Please contact support.' }, { status: 501 })
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
