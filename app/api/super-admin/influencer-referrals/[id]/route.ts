import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { id } = await params

    const referral = await prisma.influencerReferral.findUnique({ where: { id } })
    if (!referral) {
      return NextResponse.json({ error: 'Influencer referral not found' }, { status: 404 })
    }

    if (referral.incentivePaid) {
      return NextResponse.json(
        { error: 'This referral has already been marked as paid' },
        { status: 409 }
      )
    }

    const updated = await prisma.influencerReferral.update({
      where: { id },
      data: { incentivePaid: true, incentivePaidAt: new Date() },
    })

    return NextResponse.json({ referral: updated })
  } catch (error) {
    console.error('Super Admin mark influencer referral paid error:', error)
    return NextResponse.json({ error: 'Failed to mark referral as paid' }, { status: 500 })
  }
}
