import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { getOrderItemEligibility } from '@/lib/returns/ui/eligibility'

export const dynamic = 'force-dynamic'

function unauth() {
  const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  response.cookies.set('token', '', { expires: new Date(0), path: '/' })
  return response
}

function invalidOrderItemId() {
  return NextResponse.json({ error: 'Invalid order item' }, { status: 400 })
}

export async function GET(request: NextRequest) {
  if (!isReturnsFlowEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const token = request.cookies.get('token')?.value
  if (!token) return unauth()
  const outcome = await verifyToken(token)
  if (!outcome.authenticated) return unauth()
  const payload = outcome
  if (payload.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const orderItemId = searchParams.get('orderItemId')
  if (!orderItemId) return invalidOrderItemId()

  const nowParam = searchParams.get('now')
  let now: number | undefined
  if (nowParam !== null && nowParam !== '') {
    const asMs = Number(nowParam)
    const parsed = Number.isFinite(asMs) ? asMs : new Date(nowParam).getTime()
    if (!Number.isFinite(parsed)) return invalidOrderItemId()
    now = parsed
  }

  try {
    const result = await getOrderItemEligibility(payload.userId, orderItemId, { now })
    const elig = result.eligibility
    return NextResponse.json({
      eligible: elig.eligible,
      ...(elig.eligible
        ? { maxRefundAmount: elig.maxRefundAmount.toFixed(2) }
        : { reason: elig.reason }),
      windowDays: result.windowDays,
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
