import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { escalate } from '@/lib/returns/return-service'

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

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    const contentLength = request.headers.get('content-length')
    if (contentLength && Number(contentLength) > 0) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
  }

  if (Object.keys(body).length > 0) {
    return NextResponse.json({ error: 'No request body fields allowed' }, { status: 400 })
  }

  try {
    const result = await escalate(getPrisma(), {
      returnRequestId: params.returnId,
      actor: 'ADMIN',
      actorId: superAdmin.userId,
      now: new Date(),
    })
    return NextResponse.json(
      { returnRequestId: params.returnId, status: 'ESCALATED' },
      { status: 200 }
    )
  } catch (error: any) {
    if (error && typeof error.status === 'number') {
      const responseBody: Record<string, unknown> = {
        error: error.message,
        code: error.code,
        returnRequestId: params.returnId,
      }
      if (error.status === 409) {
        const current = await getPrisma().returnRequest.findUnique({
          where: { id: params.returnId },
          select: { status: true },
        })
        responseBody.status = current?.status ?? null
      }
      return NextResponse.json(responseBody, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to escalate return' }, { status: 500 })
  }
}
