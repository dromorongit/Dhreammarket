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

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [gmv, orders, bookings, topVendors, topProducts, topServices, topCategories, topSearches, couponStats, vendorPerformance] = await Promise.all([
      getPrisma().order.aggregate({
        where: { createdAt: { gte: today }, paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
      getPrisma().order.count({ where: { createdAt: { gte: today } } }),
      getPrisma().serviceRequest.count({ where: { createdAt: { gte: today } } }),
      getPrisma().store.findMany({
        select: { id: true, name: true, slug: true, averageRating: true, reviewCount: true, badgeTier: true },
        orderBy: { averageRating: 'desc' },
        take: 10,
      }),
      getPrisma().product.findMany({
        orderBy: { salesCount: 'desc' },
        take: 10,
        select: { id: true, name: true, salesCount: true, averageRating: true },
      }),
      getPrisma().service.findMany({
        where: { status: 'PUBLISHED', isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true },
      }),
      getPrisma().productCategory.findMany({
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
        take: 10,
      }),
      getPrisma().searchSuggestion.findMany({
        orderBy: { popularity: 'desc' },
        take: 10,
        select: { query: true, type: true, popularity: true },
      }),
      getPrisma().coupon.findMany({
        where: { isActive: true },
        select: { id: true, code: true, type: true, value: true, usageLimit: true, usedCount: true },
      }),
      getPrisma().store.findMany({
        select: { id: true, name: true, slug: true, averageRating: true, badgeTier: true },
        orderBy: { averageRating: 'desc' },
        take: 10,
      }),
    ])

    const conversionRate = orders > 0 ? (bookings / orders) * 100 : 0

    return NextResponse.json({
      kpis: {
        gmv: gmv._sum.total || 0,
        orders,
        bookings,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        activeCoupons: couponStats.length,
        couponUsage: couponStats.reduce((sum, c) => sum + (c.usedCount || 0), 0),
      },
      topVendors,
      topProducts,
      topServices,
      topCategories,
      topSearches,
      vendorPerformance,
    })
  } catch (error) {
    console.error('Error fetching marketplace intelligence:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}