import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const prisma = getPrisma()
    // Check admin authorization
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    // Get counts and financial data
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
    ] = await Promise.all([
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
    ])

    // Calculate financial totals from paid orders
    let totalGrossAmount = 0
    let totalProcessorFee = 0
    let totalNetAmount = 0
    let totalPlatformCommission = 0
    let totalVendorEarnings = 0
    let totalRevenue = 0 // For backward compatibility
    
    paidOrders.forEach((order: any) => {
      // Use grossAmount if available, fallback to total
      const gross = order.grossAmount !== null && order.grossAmount !== undefined ? order.grossAmount : order.total
      totalGrossAmount += gross
      
      // Processor fee might be null
      if (order.processorFee !== null && order.processorFee !== undefined) {
        totalProcessorFee += order.processorFee
      }
      
      // Net amount might be null
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
      
      // For backward compatibility, use total or gross amount
      totalRevenue += gross
    })

    // Count reviews and categories
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

    return NextResponse.json({
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
        totalRevenue, // Keep for backward compatibility
        totalReviews,
        totalCategories: totalProductCategories, // Product categories count for frontend compatibility
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
      },
      recentOrders,
      recentUsers,
      recentVendors,
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}