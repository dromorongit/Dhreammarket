import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { closeSettledReturn } from '@/lib/returns/return-service'

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

  if (Object.keys(body).length > 0) {
    return NextResponse.json({ error: 'No request body fields allowed' }, { status: 400 })
  }

  try {
    const result = await closeSettledReturn(getPrisma(), {
      returnRequestId: params.returnId,
      now: new Date(),
      actorId: superAdmin.userId,
    })

    switch (result.status) {
      case 'CLOSED':
        return NextResponse.json(
          { returnRequestId: params.returnId, status: 'CLOSED' },
          { status: 200 }
        )
      case 'ALREADY_CLOSED':
        return NextResponse.json(
          { returnRequestId: params.returnId, status: 'ALREADY_CLOSED', noop: true },
          { status: 200 }
        )
      case 'REFUND_NOT_PROCESSED':
        return NextResponse.json(
          { error: 'Refund not processed', refundStatus: result.refundStatus, returnRequestId: params.returnId },
          { status: 409 }
        )
      case 'NO_REFUND':
        return NextResponse.json(
          { error: 'No refund linked', status: 'NO_REFUND', returnRequestId: params.returnId },
          { status: 409 }
        )
      default:
        return NextResponse.json({ error: 'Failed to close return' }, { status: 500 })
    }
  } catch (error: any) {
    if (error && typeof error.status === 'number') {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to close return' }, { status: 500 })
  }
}
