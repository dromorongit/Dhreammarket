import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isCancellationPolicyEnabled } from '@/lib/feature-flags'
import {
  CANCELLATION_FEE_GHS,
  BLOCK_THRESHOLD,
  BLOCK_WINDOW_DAYS,
  toPesewas,
  pesewasToGhs,
  isBlocked,
  isWithinFreeWindow,
} from '@/lib/cancellation-policy'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const orderId = params.orderId
    const now = new Date()

    // The buyer must own the order. Anything else is 404 (no existence leak
    // to other users' orders).
    const order = await getPrisma().order.findFirst({
      where: { id: orderId, userId: outcome.userId, deletedAt: null },
      select: { id: true, total: true, paymentStatus: true, source: true, createdAt: true, orderType: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found or access denied' }, { status: 404 })
    }

    const manual = order.source === 'MANUAL'
    const paid = order.paymentStatus === 'PAID'

    // Default (policy off): today's behaviour is free cancellation with the
    // full total refundable, no counter and no block.
    const notActive = {
      policyActive: false,
      free: true,
      feeAmount: 0,
      refundAmount: order.total,
      cancellationsInLast30Days: 0,
      blockedUntil: null as string | null,
      wouldTriggerBlock: false,
    }

    const policy = await getPrisma().platformPolicy.findUnique({
      where: { id: 'singleton' },
      select: { systemCutoverTimestamp: true },
    })
    const cutover = policy?.systemCutoverTimestamp

    const policyActive =
      isCancellationPolicyEnabled() &&
      Boolean(cutover) &&
      order.createdAt.getTime() >= new Date(cutover as Date).getTime()

    if (!policyActive) {
      return NextResponse.json(notActive)
    }

    const user = await getPrisma().user.findUnique({
      where: { id: outcome.userId },
      select: { cancellationBlockedUntil: true },
    })
    const blockedUntil = user?.cancellationBlockedUntil ?? null
    const blocked = isBlocked(blockedUntil, now)

    const thirtyDaysAgo = new Date(now.getTime() - BLOCK_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const cancellationsInLast30Days = await getPrisma().customerCancellation.count({
      where: {
        userId: outcome.userId,
        createdAt: { gte: thirtyDaysAgo },
      },
    })

    // The 4th cancellation in the window triggers the block, so this
    // cancellation would trigger it when 3 are already in the window.
    const wouldTriggerBlock = !blocked && cancellationsInLast30Days >= BLOCK_THRESHOLD - 1

    let free = false
    let feeAmount = 0
    let refundAmount = order.total

    if (manual || !paid) {
      // Manual and unpaid orders cancel with no fee under the policy too.
      free = true
      feeAmount = 0
      refundAmount = order.total
    } else if (!blocked) {
      free = isWithinFreeWindow(order.createdAt, now)
      if (!free) {
        const totalPesewas = toPesewas(order.total)
        const feePesewas = Math.min(toPesewas(CANCELLATION_FEE_GHS), totalPesewas)
        feeAmount = pesewasToGhs(feePesewas)
        refundAmount = pesewasToGhs(totalPesewas - feePesewas)
      }
    } else {
      // Blocked: cancellation is refused, but report the would-be fee for
      // transparency. The UI shows the blocked date instead of the cost.
      const totalPesewas = toPesewas(order.total)
      const feePesewas = Math.min(toPesewas(CANCELLATION_FEE_GHS), totalPesewas)
      feeAmount = pesewasToGhs(feePesewas)
      refundAmount = pesewasToGhs(totalPesewas - feePesewas)
    }

    return NextResponse.json({
      policyActive: true,
      free,
      feeAmount,
      refundAmount,
      cancellationsInLast30Days,
      blockedUntil: blockedUntil ? blockedUntil.toISOString() : null,
      wouldTriggerBlock,
    })
  } catch (error) {
    console.error('Error fetching cancel preview:', error)
    return NextResponse.json({ error: 'Failed to fetch cancel preview' }, { status: 500 })
  }
}
