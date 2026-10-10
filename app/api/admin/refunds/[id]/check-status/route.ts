import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireSuperAdmin } from '@/lib/adminAuth'
import { rateLimit } from '@/lib/rate-limit'
import { checkRefundStatus, RefundError, STUCK_REFUND_MIN_AGE_MS } from '@/lib/refunds'
import { logError } from '@/lib/logger'
import type { CheckStatusAction } from '@/lib/refunds'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

/**
 * POST /api/admin/refunds/[id]/check-status
 *
 * Reconciles a refund row against Paystack's authoritative refund list for the
 * payment's transaction:
 *   - a PENDING row without a Paystack id gets its unique match attached;
 *   - a row with more than one possible match is left untouched and the
 *     administrators are notified;
 *   - once the row is at least ${STUCK_REFUND_MIN_AGE_MS}ms old, a SUPER_ADMIN
 *     may mark it FAILED or resubmit it under the same row and Payment row
 *     lock (both actions are idempotent).
 *
 * Body (optional): { action: 'MARK_FAILED' | 'RESUBMIT', reason?: string }
 * Without an action the endpoint only reconciles (it attaches a unique Paystack
 * match to a PENDING row that has no Paystack id yet; it never invents a
 * match). Both manual actions are idempotent.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const rateLimitCheck = rateLimit('admin-orders')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'Refund id is required' }, { status: 400 })
    }

    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const actionRaw = typeof body.action === 'string' ? body.action.toUpperCase() : ''
    let action: CheckStatusAction | undefined

    if (actionRaw) {
      if (actionRaw !== 'MARK_FAILED' && actionRaw !== 'RESUBMIT') {
        return NextResponse.json(
          { error: "Invalid action. Use 'MARK_FAILED' or 'RESUBMIT'." },
          { status: 400 }
        )
      }
      action = actionRaw

      // Manual resolution is a super-admin capability. The 10 minute grace
      // period is enforced inside the service.
      const superAdmin = await requireSuperAdmin()
      if (superAdmin instanceof NextResponse) {
        return NextResponse.json(
          {
            error: `Only a super admin can ${action === 'MARK_FAILED' ? 'mark a refund failed' : 'resubmit a refund'}.`,
            requiresSuperAdmin: true,
          },
          { status: 403 }
        )
      }

      const result = await checkRefundStatus(
        id,
        { triggeredByUserId: superAdmin.userId, triggeredByRole: 'SUPER_ADMIN' },
        action
      )
      return NextResponse.json(result)
    }

    const admin = await requireAdmin()
    if (admin instanceof NextResponse) {
      return admin
    }

    const result = await checkRefundStatus(id, {
      triggeredByUserId: admin.userId,
      triggeredByRole: admin.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof RefundError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    logError('Refund status check failed', error)
    return NextResponse.json({ error: 'Failed to check refund status' }, { status: 500 })
  }
}
