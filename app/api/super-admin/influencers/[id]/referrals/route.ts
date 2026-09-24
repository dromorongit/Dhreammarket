import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { id } = await params

    const influencer = await prisma.influencer.findUnique({ where: { id } })
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })
    }

    const referrals = await prisma.influencerReferral.findMany({
      where: { influencerId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        referee: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    })

    const formatted = referrals.map((referral) => ({
      id: referral.id,
      refereeId: referral.refereeId,
      refereeEmail: referral.referee.email,
      refereeName: referral.referee.profile
        ? `${referral.referee.profile.firstName ?? ''} ${referral.referee.profile.lastName ?? ''}`.trim() || referral.referee.email
        : referral.referee.email,
      refereeRole: referral.referee.role,
      codeUsed: referral.codeUsed,
      registrationIpAddress: referral.registrationIpAddress,
      qualified: referral.qualified,
      qualifiedAt: referral.qualifiedAt,
      incentiveAmount: referral.incentiveAmount,
      incentivePaid: referral.incentivePaid,
      incentivePaidAt: referral.incentivePaidAt,
      createdAt: referral.createdAt,
    }))

    return NextResponse.json({ referrals: formatted })
  } catch (error) {
    console.error('Super Admin influencer referrals error:', error)
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 })
  }
}
