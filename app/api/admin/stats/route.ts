import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { getAdminDemandAnalytics } from '@/lib/demand-forecast'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.log('[ADMIN STATS] GET request started')
  try {
    const prisma = getPrisma()
    console.log('[ADMIN STATS] Prisma client obtained')
    // Check admin authorization
    const authCheck = requireAdmin()
    console.log('[ADMIN STATS] Auth check result:', authCheck instanceof NextResponse ? `response ${authCheck.status}` : 'authorized')
    if (authCheck instanceof NextResponse) {
      console.log('[ADMIN STATS] Auth check returned error response:', authCheck.status)
      return authCheck
    }

    // Get counts and financial data
    console.log('[ADMIN STATS] Starting Prisma queries for dashboard stats')
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
    ] = await Promise.all([
      console.log('[ADMIN STATS] Query: prisma.user.count()'), prisma.user.count(),
      console.log('[ADMIN STATS] Query: prisma.user.count({ role: VENDOR })'), prisma.user.count({ where: { role: 'VENDOR' } }),
      console.log('[ADMIN STATS] Query: prisma.product.count()'), prisma.product.count(),
      console.log('[ADMIN STATS] Query: prisma.order.count()'), prisma.order.count(),
      console.log('[ADMIN STATS] Query: prisma.order.findMany({ paymentStatus: PAID })'), prisma.order.findMany({
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
      console.log('[ADMIN STATS] Query: prisma.store.count({ isVerified: true })'), prisma.store.count({ where: { isVerified: true } }),
      console.log('[ADMIN STATS] Query: prisma.vendorVerificationApplication.count({ status: PENDING_REVIEW })'), prisma.vendorVerificationApplication.count({ where: { status: 'PENDING_REVIEW' } }),
      console.log('[ADMIN STATS] Query: prisma.order.findMany({ recent 10 })'), prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { email: true, role: true },
          },
        },
      }),
      console.log('[ADMIN STATS] Query: prisma.user.findMany({ recent 10 })'), prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      console.log('[ADMIN STATS] Query: prisma.store.findMany({ recent 10 })'), prisma.store.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { email: true, role: true },
          },
        },
      }),
      console.log('[ADMIN STATS] Query: prisma.order.findMany({ PREORDER paid })'), prisma.order.findMany({
        where: { orderType: 'PREORDER', paymentStatus: 'PAID' },
        select: { fulfillmentStatus: true },
      }),
      console.log('[ADMIN STATS] Query: prisma.order.findMany({ BACKORDER paid })'), prisma.order.findMany({
        where: { orderType: 'BACKORDER', paymentStatus: 'PAID' },
        select: { fulfillmentStatus: true },
      }),
      console.log('[ADMIN STATS] Query: prisma.order.count({ overdue })'), prisma.order.count({
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
      console.log('[ADMIN STATS] Query: prisma.order.findMany({ completed preorders })'), prisma.order.findMany({
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
      console.log('[ADMIN STATS] Query: prisma.order.count({ READY_TO_FULFILL })'), prisma.order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          fulfillmentStatus: 'READY_TO_FULFILL',
        },
      }),
      console.log('[ADMIN STATS] Query: prisma.order.count({ PREORDER awaiting stock })'), prisma.order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: 'PREORDER',
          fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK'] },
        },
      }),
      console.log('[ADMIN STATS] Query: prisma.order.count({ BACKORDER awaiting stock })'), prisma.order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: 'BACKORDER',
          fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK'] },
        },
      }),
    ])
    console.log('[ADMIN STATS] All Prisma queries completed')

    // Calculate financial totals from paid orders
    let totalGrossAmount = 0
    let totalProcessorFee = 0
    let totalNetAmount = 0
    let totalPlatformCommission = 0
    let totalVendorEarnings = 0
    let totalRevenue = 0 // Total Platform Revenue = platformCommission only
     
    paidOrders.forEach((order: any) => {
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
      const totalDays = completedPreorderOrders.reduce((sum, order) => {
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
    console.error('[ADMIN STATS] Error:', error)
    console.error('[ADMIN STATS] Error stack:', error?.stack)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}