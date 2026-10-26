import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { adminDecide } from '@/lib/returns/return-service'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { returnId: string } }
) {
  if (!isReturnsFlowEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

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

  const allowed = new Set(['decision', 'approve', 'approved', 'action', 'response', 'amount', 'approvedAmount', 'refundAmount', 'note', 'adminNote', 'reason'])
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      return NextResponse.json({ error: `Unknown field: ${key}` }, { status: 400 })
    }
  }

  try {
    const result = await adminDecide(getPrisma(), {
      returnRequestId: params.returnId,
      decision: body.decision as any,
      approve: body.approve as any,
      approved: body.approved as any,
      action: body.action as any,
      response: body.response as any,
      amount: body.amount as any,
      approvedAmount: body.approvedAmount as any,
      refundAmount: body.refundAmount as any,
      note: body.note as any,
      adminNote: body.adminNote as any,
      reason: body.reason as any,
      actorId: superAdmin.userId,
    })
    return NextResponse.json({ returnRequest: result })
  } catch (error: any) {
    if (error && typeof error.status === 'number') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to decide' }, { status: 500 })
  }
}