import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

function unauth() {
  const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  response.cookies.set('token', '', { expires: new Date(0), path: '/' })
  return response
}

export async function GET(
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
  if (payload.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rr = await getPrisma().returnRequest.findFirst({
    where: { id: params.returnId, customerId: payload.userId },
    select: {
      id: true,
      status: true,
      reason: true,
      quantity: true,
      escalationDeadline: true,
      createdAt: true,
      updatedAt: true,
      orderItemId: true,
      policySnapshot: true,
    },
  })
  if (!rr) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ returnRequest: rr })
}