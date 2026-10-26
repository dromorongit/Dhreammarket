import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { openReturn } from '@/lib/returns/return-service'
import { createReturnError } from '@/lib/returns/types'

export const dynamic = 'force-dynamic'

const ALLOWED_REASONS = new Set(['NOT_AS_DESCRIBED', 'DAMAGED', 'WRONG_ITEM', 'NOT_RECEIVED', 'CHANGE_OF_MIND', 'OTHER'])

function unauth() {
  const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  response.cookies.set('token', '', { expires: new Date(0), path: '/' })
  return response
}

export async function POST(request: NextRequest) {
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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const allowed = new Set(['orderItemId', 'reason', 'quantity', 'requestedAmount', 'amount', 'refundAmount', 'requestedRefundAmount', 'attachments'])
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      return NextResponse.json({ error: `Unknown field: ${key}` }, { status: 400 })
    }
  }

  const orderItemId = typeof body.orderItemId === 'string' ? body.orderItemId.trim() : ''
  if (!orderItemId) return NextResponse.json({ error: 'orderItemId is required' }, { status: 400 })

  const reason = typeof body.reason === 'string' ? body.reason.trim().toUpperCase() : 'OTHER'
  if (!ALLOWED_REASONS.has(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
  }

  // ownership check
  const item = await getPrisma().orderItem.findUnique({
    where: { id: orderItemId },
    select: { order: { select: { userId: true } } },
  })
  if (!item || item.order?.userId !== payload.userId) {
    return NextResponse.json({ error: 'Order item not found or access denied' }, { status: 404 })
  }

  const quantity = body.quantity !== undefined ? Number(body.quantity) : undefined
  if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1)) {
    return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
  }

  const requestedAmount = body.requestedAmount ?? body.amount ?? body.refundAmount ?? body.requestedRefundAmount

  try {
    const result = await openReturn(getPrisma(), {
      customerId: payload.userId,
      orderItemId,
      reason,
      quantity,
      requestedAmount: requestedAmount as any,
      attachments: Array.isArray(body.attachments) ? (body.attachments as any) : undefined,
    })
    return NextResponse.json({ returnRequest: result }, { status: 201 })
  } catch (error: any) {
    if (error && typeof error.status === 'number') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to open return' }, { status: 500 })
  }
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

  const requests = await getPrisma().returnRequest.findMany({
    where: { customerId: payload.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      reason: true,
      quantity: true,
      escalationDeadline: true,
      createdAt: true,
      updatedAt: true,
      orderItemId: true,
    },
  })
  return NextResponse.json({ returnRequests: requests })
}