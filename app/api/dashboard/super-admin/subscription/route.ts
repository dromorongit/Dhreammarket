import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { getSubscriptionRevenueDashboard, getUpcomingRenewals, getExpiredSubscriptions, getSubscriptionPlans } from '@/lib/subscription/subscription-service'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) {
    return { error: 'Unauthorized', status: 401, payload: null }
  }
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'SUPER_ADMIN') {
    return { error: 'Forbidden', status: 403, payload: null }
  }
  return { error: null, status: 200, payload }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'revenue': {
        const revenue = await getSubscriptionRevenueDashboard()
        return NextResponse.json({ revenue })
      }

      case 'upcomingRenewals': {
        const days = parseInt(searchParams.get('days') || '30', 10)
        const renewals = await getUpcomingRenewals(days)
        return NextResponse.json({ renewals })
      }

      case 'expired': {
        const expired = await getExpiredSubscriptions()
        return NextResponse.json({ expired })
      }

      case 'distribution': {
        const prisma = getPrisma()
        const dist = await prisma.vendorSubscription.groupBy({
          by: ['planId'],
          where: { status: 'ACTIVE' },
          _count: { id: true },
          _sum: { totalPaid: true },
        })
        const plans = await prisma.subscriptionPlan.findMany({
          where: { isActive: true },
          select: { id: true, name: true, priceMonthly: true, priceYearly: true },
        })
        const planMap = Object.fromEntries(plans.map((p) => [p.id, p]))
        return NextResponse.json({
          distribution: dist.map((d) => ({
            planName: planMap[d.planId]?.name ?? 'Unknown',
            count: d._count.id,
            totalPaid: d._sum.totalPaid ?? 0,
          })),
        })
      }

      case 'plans': {
        const plans = await getSubscriptionPlans()
        return NextResponse.json({ plans })
      }

      case 'analytics': {
        const prisma = getPrisma()
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const yearStart = new Date(now.getFullYear(), 0, 1)

        const [mrr, arr, totalRevenue, activeCount] = await Promise.all([
          prisma.subscriptionPayment.aggregate({
            where: { status: 'PAID', createdAt: { gte: monthStart, lte: now } },
            _sum: { amount: true },
          }),
          prisma.subscriptionPayment.aggregate({
            where: { status: 'PAID', createdAt: { gte: yearStart, lte: now } },
            _sum: { amount: true },
          }),
          prisma.subscriptionPayment.aggregate({
            where: { status: 'PAID' },
            _sum: { amount: true },
          }),
          prisma.vendorSubscription.count({ where: { status: 'ACTIVE' } }),
        ])

        const topVendors = await prisma.vendorSubscription.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { totalPaid: 'desc' },
          take: 10,
          include: { vendor: { select: { email: true } }, plan: { select: { name: true } } },
        })

        return NextResponse.json({
          analytics: {
            mrr: mrr._sum.amount ?? 0,
            arr: arr._sum.amount ?? 0,
            totalRevenue: totalRevenue._sum.amount ?? 0,
            activeSubscriptions: activeCount,
            topPayingVendors: topVendors.map((v) => ({
              vendorId: v.vendorId,
              vendorName: v.vendor?.email ?? 'Unknown',
              planName: v.plan?.name ?? 'Unknown',
              totalPaid: v.totalPaid,
            })),
          },
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    logError('Error in super admin subscription endpoint:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}