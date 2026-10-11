import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { rateLimit } from '@/lib/rate-limit'
import { createRefund, getRefundHistory, RefundError, toRefundTriggeredByRole } from '@/lib/refunds'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/refunds
 *
 * Manual refund entry point. A client-supplied requestId (UUID) is REQUIRED
 * and is used verbatim as the Refund idempotency key, so a double submit can
 * never issue two Paystack refunds. The UI must send confirmRefund: true.
 *
 * Refunds move real money through Paystack, so this endpoint - and every
 * other refund endpoint - is restricted to SUPER_ADMIN. A plain ADMIN, a
 * CUSTOMER or a VENDOR gets 403; an unauthenticated caller gets 401.
 *
 * Wallet-assisted and wallet-only orders are refused with 409 and must be
 * refunded manually - there is no wallet credit logic here.
 *
 * Body:
 *   orderId:           string  (required)
 *   requestId:         string  (required, UUID)
 *   confirmRefund:     boolean (required, must be true)
 *   reason:            string  (optional)
 *   items?:            { orderItemId: string, amount?: number }[] (optional)
 *
 * When items is omitted, every refundable item on the order is refunded at its
 * full remaining cap.
 */
export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('admin-orders')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const superAdmin = await requireSuperAdmin()
    if (superAdmin instanceof NextResponse) {
      return superAdmin
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : undefined

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }

    if (body.confirmRefund !== true) {
      return NextResponse.json(
        { error: 'Refund not confirmed. Re-confirm the refund to continue.' },
        { status: 400 }
      )
    }

    let items: { orderItemId: string; amount?: number }[] | undefined
    if (Array.isArray(body.items)) {
      items = body.items
        .filter(
          (entry): entry is { orderItemId: string; amount?: number } =>
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as { orderItemId?: unknown }).orderItemId === 'string'
        )
        .map((entry) => ({
          orderItemId: entry.orderItemId,
          amount:
            typeof (entry as { amount?: unknown }).amount === 'number'
              ? ((entry as { amount: number }).amount)
              : undefined,
        }))
      if (items.length === 0) items = undefined
    }

    const orderItemId = typeof body.orderItemId === 'string' ? body.orderItemId.trim() : ''
    const amount = typeof body.amount === 'number' ? body.amount : undefined

    // Convenience single-item form: { orderId, orderItemId, amount }.
    if (!items && orderItemId) {
      items = [{ orderItemId, amount }]
    }

    const result = await createRefund({
      orderId,
      items,
      reason,
      source: 'MANUAL',
      reference: requestId,
      actor: {
        triggeredByUserId: superAdmin.userId,
        // Taken from the verified session, never hardcoded.
        triggeredByRole: toRefundTriggeredByRole(superAdmin.role),
      },
    })

    return NextResponse.json({
      message: result.alreadyProcessed
        ? 'This refund was already processed.'
        : 'Refund processed successfully',
      ...result,
    })
  } catch (error) {
    if (error instanceof RefundError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    logError('Manual refund failed', error)
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 })
  }
}

/**
 * GET /api/admin/refunds?orderId=<id>
 *
 * Refund history for an order. Used by the admin order detail page so the
 * confirmation dialog can show what has already been refunded. Restricted to
 * SUPER_ADMIN together with the POST above.
 */
export async function GET(request: NextRequest) {
  const rateLimitCheck = rateLimit('admin-orders')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const superAdmin = await requireSuperAdmin()
    if (superAdmin instanceof NextResponse) {
      return superAdmin
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const refunds = await getRefundHistory(orderId)
    return NextResponse.json({ refunds })
  } catch (error) {
    logError('Manual refund history failed', error)
    return NextResponse.json({ error: 'Failed to load refund history' }, { status: 500 })
  }
}
