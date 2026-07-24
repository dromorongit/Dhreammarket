import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { cleanupOldAuditLogs } from '@/lib/audit-log'
import { expireIdleSessions, cleanupExpiredSessions } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const authCheck = requireAdmin()
  if (authCheck instanceof NextResponse) {
    return authCheck
  }

  try {
    const body = await request.json().catch(() => ({}))
    const type = body.type as string | undefined

    if (type === 'audit-logs') {
      const deletedCount = await cleanupOldAuditLogs()
      return NextResponse.json({ deletedCount, type: 'audit-logs' })
    }

    if (type === 'sessions') {
      const expiredCount = await expireIdleSessions()
      const cleanedCount = await cleanupExpiredSessions()
      return NextResponse.json({ expiredCount, cleanedCount, type: 'sessions' })
    }

    if (type === 'all') {
      const auditDeletedCount = await cleanupOldAuditLogs()
      const sessionExpiredCount = await expireIdleSessions()
      const sessionCleanedCount = await cleanupExpiredSessions()
      return NextResponse.json({
        type: 'all',
        auditDeletedCount,
        sessionExpiredCount,
        sessionCleanedCount,
      })
    }

    return NextResponse.json({ error: 'Invalid cleanup type. Use audit-logs, sessions, or all.' }, { status: 400 })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const authCheck = requireAdmin()
  if (authCheck instanceof NextResponse) {
    return authCheck
  }

  return NextResponse.json({
    endpoints: [
      { method: 'POST', path: '/api/admin/cleanup', body: { type: 'audit-logs' | 'sessions' | 'all' } },
    ],
  })
}
