import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { LoyaltyEngine } from '@/lib/loyalty/loyalty-engine'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const payload = outcome
    if (payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [pointsBalance, cashbackBalance, tier, achievements, referralStats, recentTransactions, loyaltyRecord, userRecord] = await Promise.all([
      LoyaltyEngine.reward.getPointsBalance(payload.userId),
      LoyaltyEngine.cashback.getCashbackBalance(payload.userId),
      LoyaltyEngine.tier.getCurrentTier(payload.userId),
      LoyaltyEngine.achievement.getUserAchievements(payload.userId),
      LoyaltyEngine.referral.getReferralStats(payload.userId),
      LoyaltyEngine.reward.getPointsHistory(payload.userId, 1, 10),
      getPrisma().customerLoyalty.findUnique({
        where: { userId: payload.userId },
        select: {
          lastDailyLoginRewardAt: true,
          profileCompletionRewarded: true,
          followVendorRewardClaimed: true,
          lastWishlistRewardAt: true,
          walletBalance: true,
        },
      }),
      getPrisma().user.findUnique({
        where: { id: payload.userId },
        select: { referralCode: true },
      }),
    ])

    return NextResponse.json({
      pointsBalance,
      cashbackBalance,
      walletBalance: loyaltyRecord?.walletBalance ?? 0,
      tier,
      achievements,
      referralStats,
      referralCode: userRecord?.referralCode || null,
      recentTransactions: recentTransactions.transactions,
      guards: loyaltyRecord ? {
        lastDailyLoginRewardAt: loyaltyRecord.lastDailyLoginRewardAt,
        profileCompletionRewarded: loyaltyRecord.profileCompletionRewarded,
        followVendorRewardClaimed: loyaltyRecord.followVendorRewardClaimed,
        lastWishlistRewardAt: loyaltyRecord.lastWishlistRewardAt,
      } : null,
    })
  } catch (error) {
    console.error('Error fetching loyalty dashboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}