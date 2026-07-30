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
    if (!payload || (payload.role !== 'VENDOR' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
      select: { id: true },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const [revenue, bookings, topProducts, topServices, couponUsages, followers, analytics] = await Promise.all([
      getPrisma().orderItem.aggregate({
        where: { product: { storeId: store.id } },
        _sum: { grossAmount: true, netAmount: true, vendorEarnings: true },
        _count: { id: true },
      }),
      getPrisma().serviceRequest.aggregate({
        where: { vendorId: payload.userId },
        _count: { id: true },
      }),
      getPrisma().product.findMany({
        where: { storeId: store.id },
        select: { id: true, name: true, salesCount: true, averageRating: true },
        orderBy: { salesCount: 'desc' },
        take: 5,
      }),
      getPrisma().service.findMany({
        where: { vendorId: payload.userId },
        select: { id: true, title: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      getPrisma().couponUsage.findMany({
        where: { userId: payload.userId },
        select: { couponId: true, usedAt: true },
        orderBy: { usedAt: 'desc' },
        take: 10,
      }),
      getPrisma().vendorFollow.count({ where: { vendorId: payload.userId } }),
      getPrisma().vendorAnalytics.findMany({
        where: { vendorId: payload.userId },
        orderBy: { date: 'desc' },
        take: 30,
      }),
    ])

    return NextResponse.json({
      revenue: {
        gross: revenue._sum.grossAmount || 0,
        net: revenue._sum.netAmount || 0,
        earnings: revenue._sum.vendorEarnings || 0,
        orderCount: revenue._count.id,
      },
      bookings: { count: bookings._count.id },
      topProducts,
      topServices,
      couponUsages,
      followerCount: followers,
      analytics,
    })
  } catch (error) {
    console.error('Error fetching vendor dashboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}