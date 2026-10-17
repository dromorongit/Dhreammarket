import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { getAdminDemandAnalytics } from '@/lib/demand-forecast'
import { PerformanceLogger } from '@/lib/performance'
import { SALE_ORDER_FILTER } from '@/lib/order-sale-filter'
import { ONLINE_SALE_ORDER_FILTER } from '@/lib/order-source'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const prisma = getPrisma()
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return authCheck
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [
      totalUsers,
      totalVendors,
      totalProducts,
      totalOrders,
      verifiedVendors,
      pendingVerifications,
      totalReviews,
      totalProductCategories,
      totalVendorCategories,
      paidOrderCount,
      recentOrders,
      recentUsers,
      recentVendors,
      overdueOrders,
      revenueAgg,
      waitingAvgResult,
      fulfillmentAvgResult,
      preorderStatusGroups,
      backorderStatusGroups,
      allocatedToday,
      demandAnalytics,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'VENDOR' } }),
      prisma.product.count(),
      prisma.order.count(),
      prisma.store.count({ where: { isVerified: true } }),
      prisma.vendorVerificationApplication.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.productReview.count(),
      prisma.productCategory.count(),
      prisma.vendorCategory.count(),
      prisma.order.count({ where: { paymentStatus: 'PAID' } }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          total: true,
          createdAt: true,
          user: { select: { email: true, role: true } },
        },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      prisma.store.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          user: { select: { email: true, role: true } },
        },
      }),
      prisma.order.count({
        where: {
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          paymentStatus: 'PAID',
          fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK'] },
          OR: [
            { items: { some: { expectedArrivalDate: { lt: new Date() } } } },
            { items: { some: { expectedRestockDate: { lt: new Date() } } } },
          ],
        },
      }),
      // Revenue used to be raw SQL over every PAID order, so a cancelled
      // order awaiting its refund was still summed as money taken. The shared
      // sale filter is the PRISMA equivalent, kept here for the same reason:
      // one definition of a sale across every reader.
      prisma.order.aggregate({
        where: { ...ONLINE_SALE_ORDER_FILTER },
        _sum: {
          total: true,
          grossAmount: true,
          processorFee: true,
          netAmount: true,
          platformCommission: true,
          vendorEarnings: true,
        },
      }),
      prisma.$queryRaw<Array<{ avg_days: number | null }>>`
        SELECT ROUND(SUM(FLOOR(EXTRACT(EPOCH FROM now() - "createdAt") / 86400)) / NULLIF(COUNT(*), 0)) as avg_days
        FROM "orders"
        WHERE "paymentStatus" = 'PAID'
          AND "orderType" IN ('PREORDER', 'BACKORDER')
          AND "fulfillmentStatus" IN ('AWAITING_STOCK', 'AWAITING_RESTOCK')
      `,
      prisma.$queryRaw<Array<{ avg_days: number | null }>>`
        SELECT ROUND(SUM(FLOOR(EXTRACT(EPOCH FROM "updatedAt" - "createdAt") / 86400)) / NULLIF(COUNT(*), 0)) as avg_days
        FROM "orders"
        WHERE "paymentStatus" = 'PAID'
          AND "orderType" IN ('PREORDER', 'BACKORDER')
          AND "status" IN ('DELIVERED', 'COMPLETED')
      `,
      prisma.order.groupBy({
        by: ['fulfillmentStatus'],
        where: { orderType: 'PREORDER', paymentStatus: 'PAID' },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ['fulfillmentStatus'],
        where: { orderType: 'BACKORDER', paymentStatus: 'PAID' },
        _count: true,
      }),
      prisma.order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          allocatedAt: { gte: today, lt: tomorrow },
        },
      }),
      getAdminDemandAnalytics(),
    ])

     perf.markPrismaEnd(prismaPerfStart)

     const groupByFulfillmentStatus = (groups: { fulfillmentStatus: string; _count: number }[]) => {
       return groups.map(({ fulfillmentStatus, _count }) => ({ status: fulfillmentStatus, count: _count }))
     }

     const preorderAnalytics = {
      total: preorderStatusGroups.reduce((sum, g) => sum + g._count, 0),
      byStatus: groupByFulfillmentStatus(preorderStatusGroups),
    }

    const backorderAnalytics = {
      total: backorderStatusGroups.reduce((sum, g) => sum + g._count, 0),
      byStatus: groupByFulfillmentStatus(backorderStatusGroups),
    }

    const readyToFulfill =
      (preorderStatusGroups.find(g => g.fulfillmentStatus === 'READY_TO_FULFILL')?._count || 0) +
      (backorderStatusGroups.find(g => g.fulfillmentStatus === 'READY_TO_FULFILL')?._count || 0)

    const waitingPreorders = preorderStatusGroups
      .filter(g => g.fulfillmentStatus === 'AWAITING_STOCK' || g.fulfillmentStatus === 'AWAITING_RESTOCK')
      .reduce((sum, g) => sum + g._count, 0)

    const waitingBackorders = backorderStatusGroups
      .filter(g => g.fulfillmentStatus === 'AWAITING_STOCK' || g.fulfillmentStatus === 'AWAITING_RESTOCK')
      .reduce((sum, g) => sum + g._count, 0)

    let avgWaitingDays = 0
    const waitingAvg = waitingAvgResult[0]?.avg_days
    if (waitingAvg !== null && waitingAvg !== undefined) {
      avgWaitingDays = waitingAvg
    }

    let avgFulfillmentDays = 0
    const fulfillmentAvg = fulfillmentAvgResult[0]?.avg_days
    if (fulfillmentAvg !== null && fulfillmentAvg !== undefined) {
      avgFulfillmentDays = fulfillmentAvg
    }

    let totalGrossAmount = 0
    let totalProcessorFee = 0
    let totalNetAmount = 0
    let totalPlatformCommission = 0
    let totalVendorEarnings = 0
    let totalRevenue = 0
    // `total` is kept as the gross fallback for orders created before the
    // grossAmount backfill, which is what the raw SQL COALESCE did.
    if (revenueAgg._sum) {
      totalGrossAmount =
        revenueAgg._sum.grossAmount ?? revenueAgg._sum.total ?? 0
      totalProcessorFee = revenueAgg._sum.processorFee || 0
      totalNetAmount = revenueAgg._sum.netAmount || 0
      totalPlatformCommission = revenueAgg._sum.platformCommission || 0
      totalVendorEarnings = revenueAgg._sum.vendorEarnings || 0
      totalRevenue = totalPlatformCommission
    }

    const responseData = {
      stats: {
        totalUsers,
        totalVendors,
        totalProducts,
        totalOrders,
        verifiedVendors,
        totalGrossAmount,
        totalProcessorFee,
        totalNetAmount,
        totalPlatformCommission,
        totalVendorEarnings,
        totalRevenue,
        totalReviews,
        totalCategories: totalProductCategories,
        totalProductCategories,
        totalVendorCategories,
        paidOrderCount,
        pendingVerifications,
        preorderAnalytics,
        backorderAnalytics,
        overdueOrders,
        avgFulfillmentDays,
        readyToFulfill,
        waitingPreorders,
        waitingBackorders,
        avgWaitingDays,
        allocatedToday,
      },
      demandAnalytics,
      recentOrders,
      recentUsers,
      recentVendors,
    }
    perf.log()
    return NextResponse.json(responseData)
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('[ADMIN STATS API ERROR]', error)
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
