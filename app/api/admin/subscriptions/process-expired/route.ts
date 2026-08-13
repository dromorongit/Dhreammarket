import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { getExpiredSubscriptions } from '@/lib/subscription/subscription-service'
import { createAuditLog } from '@/lib/audit-log'
import { logInfo, logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin()
    if (adminUser instanceof NextResponse) {
      return adminUser
    }

    const prisma = getPrisma()
    const expired = await getExpiredSubscriptions()

    const subscriptionIds = expired.map((e) => e.subscriptionId).filter(Boolean)

    if (subscriptionIds.length === 0) {
      return NextResponse.json({ message: 'No expired subscriptions found', processed: 0 })
    }

    const result = await prisma.vendorSubscription.updateMany({
      where: { id: { in: subscriptionIds } },
      data: { status: 'EXPIRED', updatedAt: new Date() },
    })

    await createAuditLog({
      userId: adminUser.userId,
      userRole: adminUser.role,
      action: 'SUBSCRIPTIONS_EXPIRED',
      entityType: 'SUBSCRIPTION',
      entityId: null,
      afterData: { processedCount: result.count, subscriptionIds },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    logInfo(`Processed ${result.count} expired subscriptions by admin ${adminUser.userId}`)
    return NextResponse.json({ message: 'Expired subscriptions processed', processed: result.count })
  } catch (error) {
    logError('Error processing expired subscriptions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
