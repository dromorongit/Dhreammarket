import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { purgeOldAuditLogIpAndUserAgent } from '@/lib/audit/purge'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const body = await request.json().catch(() => ({}))

    const settings = await getPrisma().superAdminSettings.findFirst()
    const retentionDays = body.retentionDays ?? settings?.auditLogRetentionDays ?? 90

    const anonymizedCount = await purgeOldAuditLogIpAndUserAgent(retentionDays)

    await createAuditLog({
      userId: authCheck.userId,
      userRole: authCheck.role,
      action: 'AUDIT_LOG_PURGED',
      entityType: 'SYSTEM',
      entityId: null,
      afterData: {
        action: 'audit_log_purge',
        retentionDays,
        anonymizedCount,
      },
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({
      success: true,
      retentionDays,
      anonymizedCount,
    })
  } catch (error) {
    console.error('Error purging audit logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
