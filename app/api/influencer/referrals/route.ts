import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireInfluencerOrSuperAdmin, getInfluencerForUser } from '@/lib/influencerAuth'
import { applyPrivacyMask, type PrivacyMode } from '@/lib/influencer-mask'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireInfluencerOrSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { userId, role } = authCheck

    let influencerId: string
    let privacyMode: PrivacyMode = 'full'

    if (role === 'SUPER_ADMIN') {
      const searchParams = request.nextUrl.searchParams
      const id = searchParams.get('id')
      if (!id) {
        return NextResponse.json({ error: 'Influencer id is required' }, { status: 400 })
      }
      influencerId = id
      privacyMode = 'full'
    } else {
      const influencer = await getInfluencerForUser(userId)
      if (!influencer) {
        return NextResponse.json({ error: 'No linked influencer record' }, { status: 403 })
      }
      influencerId = influencer.id
      privacyMode = 'influencer'
    }

    const influencer = await prisma.influencer.findUnique({ where: { id: influencerId } })
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })
    }

    const referrals = await prisma.influencerReferral.findMany({
      where: { influencerId },
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
      qualified: referral.qualified,
      qualifiedAt: referral.qualifiedAt ? referral.qualifiedAt.toISOString() : null,
      incentiveAmount: referral.incentiveAmount,
      incentivePaid: referral.incentivePaid,
      incentivePaidAt: referral.incentivePaidAt ? referral.incentivePaidAt.toISOString() : null,
      createdAt: referral.createdAt.toISOString(),
    }))

    const masked = applyPrivacyMask(formatted, privacyMode)

    return NextResponse.json({ referrals: masked })
  } catch (error) {
    console.error('Influencer referrals error:', error)
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 })
  }
}
