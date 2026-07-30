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
    if (!payload || payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [recentlyViewed, followedVendors, savedSearches, coupons, recommendations, recentOrders, recentServiceRequests] = await Promise.all([
      getPrisma().recentlyViewed.findMany({
        where: { userId: payload.userId },
        select: { entityType: true, entityId: true, viewedAt: true },
        orderBy: { viewedAt: 'desc' },
        take: 10,
      }),
      getPrisma().vendorFollow.findMany({
        where: { userId: payload.userId },
        select: { vendorId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      getPrisma().savedSearch.findMany({
        where: { userId: payload.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      getPrisma().couponUsage.findMany({
        where: { userId: payload.userId },
        select: { couponId: true, usedAt: true },
        orderBy: { usedAt: 'desc' },
        take: 10,
      }),
      getPrisma().recommendation.findMany({
        where: { userId: payload.userId },
        select: { entityType: true, entityId: true, reason: true, score: true },
        orderBy: { score: 'desc' },
        take: 10,
      }),
      getPrisma().order.findMany({
        where: { userId: payload.userId },
        select: { id: true, total: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      getPrisma().serviceRequest.findMany({
        where: { customerId: payload.userId },
        select: { id: true, title: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    return NextResponse.json({
      recentlyViewed,
      followedVendors,
      savedSearches,
      coupons,
      recommendations,
      recentOrders,
      recentServiceRequests,
    })
  } catch (error) {
    console.error('Error fetching customer dashboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}