import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [totalCustomers, totalPointsEarned, totalCashbackEarned, totalRedemptions, tierDistribution, topLoyalCustomers] = await Promise.all([
      getPrisma().customerLoyalty.count(),
      getPrisma().customerLoyalty.aggregate({ _sum: { totalPointsEarned: true } }),
      getPrisma().customerLoyalty.aggregate({ _sum: { totalCashbackEarned: true } }),
      getPrisma().rewardTransaction.count(),
      getPrisma().customerLoyalty.groupBy({
        by: ['tierId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      getPrisma().customerLoyalty.findMany({
        orderBy: { totalPointsEarned: 'desc' },
        take: 10,
        include: { user: { select: { id: true, email: true, profile: true } }, tier: true },
      }),
    ])

    return NextResponse.json({
      totalCustomers,
      totalPointsEarned: totalPointsEarned._sum.totalPointsEarned ?? 0,
      totalCashbackEarned: totalCashbackEarned._sum.totalCashbackEarned ?? 0,
      totalRedemptions,
      tierDistribution,
      topLoyalCustomers,
    })
  } catch (error) {
    console.error('Error fetching loyalty analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}