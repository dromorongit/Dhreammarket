import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { getAdminDemandAnalytics } from '@/lib/demand-forecast'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

async function runQuery<T>(name: string, fn: () => Promise<T>): Promise<T> {
  console.log(`[ADMIN STATS QUERY START] ${name}`)
  try {
    const result = await fn()
    console.log(`[ADMIN STATS QUERY OK] ${name}`)
    return result
  } catch (error) {
    console.error(`[ADMIN STATS QUERY FAIL] ${name}`)
    console.error(`[ADMIN STATS QUERY FAIL] error:`, error)
    console.error(`[ADMIN STATS QUERY FAIL] stack:`, error instanceof Error ? error.stack : null)
    throw error
  }
}

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const prisma = getPrisma()
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return authCheck
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const totalUsers = await runQuery('totalUsers', () => prisma.user.count())
    console.log('[ADMIN STATS FINISHED] totalUsers')

    const totalVendors = await runQuery('totalVendors', () => prisma.user.count({ where: { role: 'VENDOR' } }))
    console.log('[ADMIN STATS FINISHED] totalVendors')

    const totalProducts = await runQuery('totalProducts', () => prisma.product.count())
    console.log('[ADMIN STATS FINISHED] totalProducts')

    const totalOrders = await runQuery('totalOrders', () => prisma.order.count())
    console.log('[ADMIN STATS FINISHED] totalOrders')

    const verifiedVendors = await runQuery('verifiedVendors', () => prisma.store.count({ where: { isVerified: true } }))
    console.log('[ADMIN STATS FINISHED] verifiedVendors')

    const pendingVerifications = await runQuery('pendingVerifications', () =>
      prisma.vendorVerificationApplication.count({ where: { status: 'PENDING_REVIEW' } }),
    )
    console.log('[ADMIN STATS FINISHED] pendingVerifications')

    const recentOrders = await runQuery('recentOrders', () =>
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
    )
    console.log('[ADMIN STATS FINISHED] recentOrders')

    const recentUsers = await runQuery('recentUsers', () =>
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
    )
    console.log('[ADMIN STATS FINISHED] recentUsers')

    const recentVendors = await runQuery('recentVendors', () =>
      prisma.store.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          user: { select: { email: true, role: true } },
        },
      }),
    )
    console.log('[ADMIN STATS FINISHED] recentVendors')

    const overdueOrders = await runQuery('overdueOrders', () =>
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
    )
    console.log('[ADMIN STATS FINISHED] overdueOrders')

    const totalReviews = await runQuery('totalReviews', () => prisma.productReview.count())
    console.log('[ADMIN STATS FINISHED] totalReviews')

    const totalProductCategories = await runQuery('totalProductCategories', () => prisma.productCategory.count())
    console.log('[ADMIN STATS FINISHED] totalProductCategories')

    const totalVendorCategories = await runQuery('totalVendorCategories', () => prisma.vendorCategory.count())
    console.log('[ADMIN STATS FINISHED] totalVendorCategories')

    const revenueAgg = await runQuery('revenueAgg_raw', () =>
      prisma.$queryRaw<Array<{
        total_gross: number | null
        total_processor: number | null
        total_net: number | null
        total_platform: number | null
        total_vendor: number | null
      }>>`
        SELECT
          SUM(COALESCE(gross_amount, total)) as total_gross,
          SUM(processor_fee) as total_processor,
          SUM(net_amount) as total_net,
          SUM(platform_commission) as total_platform,
          SUM(vendor_earnings) as total_vendor
        FROM orders
        WHERE payment_status = 'PAID'
      `,
    )
    console.log('[ADMIN STATS FINISHED] revenueAgg')

    const paidOrderCount = await runQuery('paidOrderCount', () => prisma.order.count({ where: { paymentStatus: 'PAID' } }))
    console.log('[ADMIN STATS FINISHED] paidOrderCount')

    const waitingAvgResult = await runQuery('waitingAvg_raw', () =>
      prisma.$queryRaw<Array<{ avg_days: number | null }>>`
        SELECT ROUND(SUM(FLOOR(EXTRACT(EPOCH FROM now() - created_at) / 86400)) / NULLIF(COUNT(*), 0)) as avg_days
        FROM orders
        WHERE payment_status = 'PAID'
          AND order_type IN ('PREORDER', 'BACKORDER')
          AND fulfillment_status IN ('AWAITING_STOCK', 'AWAITING_RESTOCK')
      `,
    )
    console.log('[ADMIN STATS FINISHED] waitingAvg')

    const fulfillmentAvgResult = await runQuery('fulfillmentAvg_raw', () =>
      prisma.$queryRaw<Array<{ avg_days: number | null }>>`
        SELECT ROUND(SUM(FLOOR(EXTRACT(EPOCH FROM updated_at - created_at) / 86400)) / NULLIF(COUNT(*), 0)) as avg_days
        FROM orders
        WHERE payment_status = 'PAID'
          AND order_type IN ('PREORDER', 'BACKORDER')
          AND status IN ('DELIVERED', 'COMPLETED')
      `,
    )
    console.log('[ADMIN STATS FINISHED] fulfillmentAvg')

    perf.markPrismaEnd(prismaPerfStart)

    let totalGrossAmount = 0
    let totalProcessorFee = 0
    let totalNetAmount = 0
    let totalPlatformCommission = 0
    let totalVendorEarnings = 0
    let totalRevenue = 0
    if (revenueAgg[0]) {
      totalGrossAmount = revenueAgg[0].total_gross || 0
      totalProcessorFee = revenueAgg[0].total_processor || 0
      totalNetAmount = revenueAgg[0].total_net || 0
      totalPlatformCommission = revenueAgg[0].total_platform || 0
      totalVendorEarnings = revenueAgg[0].total_vendor || 0
      totalRevenue = totalPlatformCommission
    }

    const preorderStatusGroups = await runQuery('preorderStatusGroups', () =>
      prisma.order.groupBy({
        by: ['fulfillmentStatus'],
        where: { orderType: 'PREORDER', paymentStatus: 'PAID' },
        _count: true,
      }),
    )
    console.log('[ADMIN STATS FINISHED] preorderStatusGroups')

    const backorderStatusGroups = await runQuery('backorderStatusGroups', () =>
      prisma.order.groupBy({
        by: ['fulfillmentStatus'],
        where: { orderType: 'BACKORDER', paymentStatus: 'PAID' },
        _count: true,
      }),
    )
    console.log('[ADMIN STATS FINISHED] backorderStatusGroups')

    const allocatedToday = await runQuery('allocatedToday', () =>
      prisma.order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          allocatedAt: { gte: today, lt: tomorrow },
        },
      }),
    )
    console.log('[ADMIN STATS FINISHED] allocatedToday')

    const prismaPerfEnd2 = perf.markPrismaStart()

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

    const demandAnalytics = await runQuery('getAdminDemandAnalytics', () => getAdminDemandAnalytics())
    console.log('[ADMIN STATS FINISHED] getAdminDemandAnalytics')

    perf.markPrismaEnd(prismaPerfEnd2)

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
    console.error('Message:', error instanceof Error ? error.message : error)
    console.error('Stack:', error instanceof Error ? error.stack : null)
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    }, { status: 500 })
  }
}
