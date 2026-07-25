import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { getAdminDemandAnalytics } from '@/lib/demand-forecast'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.log('[ADMIN STATS API] Route reached');
  console.log('[ADMIN STATS] GET request started')
  try {
    const prisma = getPrisma()
    console.log('[ADMIN STATS] Prisma client obtained')
    console.log('[ADMIN STATS API] Query Params:', Object.fromEntries(new URL(request.url).searchParams.entries()));
    // Check admin authorization
    const authCheck = requireAdmin()
    console.log('[ADMIN STATS] Auth check result:', authCheck instanceof NextResponse ? `response ${authCheck.status}` : 'authorized')
    if (authCheck instanceof NextResponse) {
      console.log('[ADMIN STATS] Auth check returned error response:', authCheck.status)
      return authCheck
    }

    // Get counts and financial data
    console.log('[ADMIN STATS] Starting Prisma queries for dashboard stats')
    console.log('[ADMIN STATS] Query: prisma.user.count()')
    console.log('[ADMIN STATS] Query: prisma.user.count({ role: VENDOR })')
    console.log('[ADMIN STATS] Query: prisma.product.count()')
    console.log('[ADMIN STATS] Query: prisma.order.count()')
    console.log('[ADMIN STATS] Executing prisma.order.findMany({ paymentStatus: PAID })')
    console.log('[ADMIN STATS] Query: prisma.store.count({ isVerified: true })')
    console.log('[ADMIN STATS] Query: prisma.vendorVerificationApplication.count({ status: PENDING_REVIEW })')
    console.log('[ADMIN STATS] Executing prisma.order.findMany({ recent 10 })')
    console.log('[ADMIN STATS] Executing prisma.user.findMany({ recent 10 })')
    console.log('[ADMIN STATS] Executing prisma.store.findMany({ recent 10 })')
    console.log('[ADMIN STATS] Executing prisma.order.findMany({ PREORDER paid })')
    console.log('[ADMIN STATS] Executing prisma.order.findMany({ BACKORDER paid })')
    console.log('[ADMIN STATS] Executing prisma.order.count({ overdue })')
    console.log('[ADMIN STATS] Executing prisma.order.findMany({ completed preorders })')
    console.log('[ADMIN STATS] Executing prisma.order.count({ READY_TO_FULFILL })')
    console.log('[ADMIN STATS] Executing prisma.order.count({ PREORDER awaiting stock })')
    console.log('[ADMIN STATS] Executing prisma.order.count({ BACKORDER awaiting stock })')
    const [
      totalUsers,
      totalVendors,
      totalProducts,
      totalOrders,
      paidOrders,
      verifiedVendors,
      pendingVerifications,
      recentOrders,
      recentUsers,
      recentVendors,
      preorderOrders,
      backorderOrders,
      overdueOrders,
      completedPreorderOrders,
      readyToFulfillOrders,
      waitingPreorders,
      waitingBackorders,
    ] = (await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'VENDOR' } }),
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.findMany({
        where: { paymentStatus: 'PAID' },
        select: {
          id: true,
          grossAmount: true,
          processorFee: true,
          netAmount: true,
          platformCommission: true,
          vendorEarnings: true,
          commissionRate: true,
          total: true,
        },
      }),
      prisma.store.count({ where: { isVerified: true } }),
      prisma.vendorVerificationApplication.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { email: true, role: true },
          },
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
        include: {
          user: {
            select: { email: true, role: true },
          },
        },
      }),
      prisma.order.findMany({
        where: { orderType: 'PREORDER', paymentStatus: 'PAID' },
        select: { fulfillmentStatus: true },
      }),
      prisma.order.findMany({
        where: { orderType: 'BACKORDER', paymentStatus: 'PAID' },
        select: { fulfillmentStatus: true },
      }),
      prisma.order.count({
        where: {
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          paymentStatus: 'PAID',
          fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK'] },
          OR: [
            {
              items: {
                some: {
                  expectedArrivalDate: { lt: new Date() },
                },
              },
            },
            {
              items: {
                some: {
                  expectedRestockDate: { lt: new Date() },
                },
              },
            },
          ],
        },
      }),
      prisma.order.findMany({
        where: {
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          paymentStatus: 'PAID',
          status: { in: ['DELIVERED', 'COMPLETED'] },
        },
        select: {
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          fulfillmentStatus: 'READY_TO_FULFILL',
        },
      }),
      prisma.order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: 'PREORDER',
          fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK'] },
        },
      }),
      prisma.order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: 'BACKORDER',
          fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK'] },
        },
      }),
    ]) as any[])
    console.log('[ADMIN STATS] All Prisma queries completed')

    // Calculate financial totals from paid orders
    let totalGrossAmount = 0
    let totalProcessorFee = 0
    let totalNetAmount = 0
    let totalPlatformCommission = 0
    let totalVendorEarnings = 0
    let totalRevenue = 0 // Total Platform Revenue = platformCommission only
     
      const orders = paidOrders as any[]
      console.log('[ADMIN STATS DEBUG] orders typeof:', typeof orders, 'Array.isArray:', Array.isArray(orders), 'value:', orders);
      orders.forEach((order: any) => {
      // Use grossAmount if available, fallback to total
      const gross = order.grossAmount !== null && order.grossAmount !== undefined ? order.grossAmount : order.total
      totalGrossAmount += gross
       
      // Processor fee might be null (legacy orders without stored fees)
      if (order.processorFee !== null && order.processorFee !== undefined) {
        totalProcessorFee += order.processorFee
      }
       
      // Net amount might be null (legacy orders without stored fees)
      if (order.netAmount !== null && order.netAmount !== undefined) {
        totalNetAmount += order.netAmount
      }
       
      // Platform commission and vendor earnings
      if (order.platformCommission !== null && order.platformCommission !== undefined) {
        totalPlatformCommission += order.platformCommission
      }
       
      if (order.vendorEarnings !== null && order.vendorEarnings !== undefined) {
        totalVendorEarnings += order.vendorEarnings
      }
       
      // Total Platform Revenue = platform commission only (per accounting model)
      if (order.platformCommission !== null && order.platformCommission !== undefined) {
        totalRevenue += order.platformCommission
      }
    })

    // Count reviews and categories
    console.log('[ADMIN STATS] Query: prisma.productReview.count(), prisma.productCategory.count(), prisma.vendorCategory.count()')
    const [totalReviews, totalProductCategories, totalVendorCategories] = await Promise.all([
      prisma.productReview.count(),
      prisma.productCategory.count(),
      prisma.vendorCategory.count(),
    ])

    // Group fulfillment status for preorder/backorder orders
    const groupByFulfillmentStatus = (orders: { fulfillmentStatus: string }[]) => {
      const statusCounts: Record<string, number> = {}
      for (const order of orders) {
        statusCounts[order.fulfillmentStatus] = (statusCounts[order.fulfillmentStatus] || 0) + 1
      }
      console.log('MAP DEBUG', {
        variableName: 'statusCounts',
        type: typeof statusCounts,
        isArray: Array.isArray(statusCounts),
        value: statusCounts,
      });
      return Object.entries(statusCounts).map(([status, count]) => ({ status, count }))
    }

    // Calculate average waiting days
    let avgWaitingDays = 0
    if (waitingPreorders > 0 || waitingBackorders > 0) {
      console.log('[ADMIN STATS] Query: prisma.order.findMany({ waiting orders })')
      const waitingOrders = await prisma.order.findMany({
        where: {
          paymentStatus: 'PAID',
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK'] },
        },
        select: { createdAt: true },
      })
       
      if (waitingOrders.length > 0) {
        const totalDays = waitingOrders.reduce((sum, order) => {
          const days = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          return sum + days
        }, 0)
        avgWaitingDays = Math.round(totalDays / waitingOrders.length)
      }
    }

    // Calculate average fulfillment days
    let avgFulfillmentDays = 0
    if (completedPreorderOrders.length > 0) {
      const totalDays = completedPreorderOrders.reduce((sum: number, order: any) => {
        const days = Math.floor(
          (new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
        )
        return sum + days
      }, 0)
      avgFulfillmentDays = Math.round(totalDays / completedPreorderOrders.length)
    }

    // Calculate allocated today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
     
    console.log('[ADMIN STATS] Query: prisma.order.count({ allocatedToday })')
    const allocatedToday = await prisma.order.count({
       where: {
         paymentStatus: 'PAID',
         orderType: { in: ['PREORDER', 'BACKORDER'] },
         allocatedAt: { gte: today, lt: tomorrow },
       },
     })

    // Get demand analytics
    console.log('[ADMIN STATS] Calling getAdminDemandAnalytics()')
    const demandAnalytics = await getAdminDemandAnalytics()
    console.log('[ADMIN STATS] getAdminDemandAnalytics() completed')

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
        paidOrderCount: paidOrders.length,
        pendingVerifications,
        preorderAnalytics: {
          total: preorderOrders.length,
          byStatus: groupByFulfillmentStatus(preorderOrders),
        },
        backorderAnalytics: {
          total: backorderOrders.length,
          byStatus: groupByFulfillmentStatus(backorderOrders),
        },
        overdueOrders,
        avgFulfillmentDays,
        readyToFulfill: readyToFulfillOrders,
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
    console.log('[ADMIN STATS] Returning response data:', JSON.stringify(responseData).substring(0, 1000))

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('[ADMIN STATS API ERROR]', error);
    console.error('Message:', error instanceof Error ? error.message : error);
    console.error('Stack:', error instanceof Error ? error.stack : null);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    }, { status: 500 })
  }
}