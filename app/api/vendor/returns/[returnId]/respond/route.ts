import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { vendorRespond } from '@/lib/returns/return-service'

export const dynamic = 'force-dynamic'

function unauth() {
  const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  response.cookies.set('token', '', { expires: new Date(0), path: '/' })
  return response
}

export async function POST(
  request: NextRequest,
  { params }: { params: { returnId: string } }
) {
  if (!isReturnsFlowEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const token = request.cookies.get('token')?.value
  if (!token) return unauth()
  const outcome = await verifyToken(token)
  if (!outcome.authenticated) return unauth()
  const payload = outcome
  if (payload.role !== 'VENDOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const allowed = new Set(['decision', 'amount', 'note'])
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      return NextResponse.json({ error: `Unknown field: ${key}` }, { status: 400 })
    }
  }

  // ownership check
  const rr = await getPrisma().returnRequest.findUnique({
    where: { id: params.returnId },
    select: { orderItem: { select: { product: { select: { store: { select: { userId: true } } } } } } },
  })
  if (!rr || rr.orderItem?.product?.store?.userId !== payload.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const result = await vendorRespond(getPrisma(), {
      returnRequestId: params.returnId,
      decision: body.decision as any,
      amount: body.amount as any,
      note: body.note as any,
      vendorId: payload.userId,
    })
    return NextResponse.json({ returnRequest: result })
  } catch (error: any) {
    if (error && typeof error.status === 'number') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to respond' }, { status: 500 })
  }
}