import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if vendor has completed onboarding (store and category)
    const isOnboarded = await isVendorOnboarded(payload.userId)
    
    // Get vendor's store
    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
      include: {
        products: {
          select: { id: true },
        },
      },
    })

    // If no store exists, return zero metrics
    if (!store) {
      return NextResponse.json({
        productCount: 0,
        activeOrderCount: 0,
        revenue: 0,
        vendorEarnings: 0,
        averageRating: 0,
        totalReviews: 0,
        bestSellers: [],
        totalPaidOrders: 0,
        hasStore: false,
        hasCategory: false,
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        cancelledOrders: 0,
        grossRevenue: 0,
        totalPayouts: 0,
        outstandingBalance: 0,
        lastPayoutDate: null,
        verificationStatus: 'NOT_APPLIED',
      })
    }

    const productIds = store.products?.map((p: { id: string }) => p.id) || []
    const productCount = productIds.length

    // Get verification application status
    const application = await getPrisma().vendorVerificationApplication.findUnique({
      where: { vendorId: payload.userId },
      select: { status: true }
    })

    // Include store onboarding status in response
    const hasStore = true
    const hasCategory = !!store.categoryId

    if (productIds.length === 0) {
      // Still fetch payout info
      const payouts = await getPrisma().vendorPayout.findMany({
        where: { vendorId: payload.userId },
      })
      
      return NextResponse.json({
        productCount: 0,
        activeOrderCount: 0,
        revenue: 0,
        vendorEarnings: 0,
        averageRating: 0,
        totalReviews: 0,
        bestSellers: [],
        totalPaidOrders: 0,
        hasStore,
        hasCategory,
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        cancelledOrders: 0,
        grossRevenue: 0,
        totalPayouts: payouts.filter((p: any) => p.status === 'PAID').reduce((sum: number, p: any) => sum + p.amount, 0),
        outstandingBalance: 0,
        lastPayoutDate: payouts.filter((p: any) => p.status === 'PAID').sort((a: any, b: any) => b.paidAt - a.paidAt)[0]?.paidAt || null,
        verificationStatus: application?.status || 'NOT_APPLIED',
      })
    }

    // Get all order statuses for vendor's products (only paid orders)
    const vendorOrders = await getPrisma().order.findMany({
      where: {
        items: {
          some: {
            productId: { in: productIds }
          }
        },
        paymentStatus: 'PAID',
      },
      select: {
        id: true,
        status: true,
        total: true,
      }
    })

    const totalOrders = vendorOrders.length
    const completedOrders = vendorOrders.filter((o: any) => o.status === 'COMPLETED' || o.status === 'DELIVERED').length
    const pendingOrders = vendorOrders.filter((o: any) => ['PENDING', 'PROCESSING', 'SHIPPED'].includes(o.status)).length
    const cancelledOrders = vendorOrders.filter((o: any) => o.status === 'CANCELLED').length

    // Get active orders (PENDING, PROCESSING, SHIPPED, DELIVERED) that contain vendor's products - only paid
    const activeOrders = await getPrisma().order.findMany({
      where: {
        items: {
          some: {
            productId: { in: productIds }
          }
        },
        status: { in: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
        paymentStatus: 'PAID', // Only count paid orders
      },
      select: {
        id: true
      }
    })

    const activeOrderCount = activeOrders.length

    // Get completed orders that contain vendor's products and calculate revenue and vendor earnings - only paid orders
    const completedOrderItems = await getPrisma().orderItem.findMany({
      where: {
        productId: { in: productIds },
        order: {
          status: { in: ['COMPLETED', 'DELIVERED'] },
          paymentStatus: 'PAID' // Only count paid orders in revenue
        }
      },
      select: {
        vendorEarnings: true,
        price: true,
        quantity: true,
      }
    })
  
    // Calculate total vendor earnings (already has commission deducted)
    let totalVendorEarnings = 0
    let grossRevenue = 0
    for (const item of completedOrderItems) {
      if (item.vendorEarnings !== null) {
        totalVendorEarnings += item.vendorEarnings
      }
      grossRevenue += item.price * item.quantity
    }
  
    // For backward compatibility, also calculate revenue
    const revenue = grossRevenue

    // Get payouts for this vendor
    const payouts = await getPrisma().vendorPayout.findMany({
      where: { vendorId: payload.userId },
    })

    const totalPayouts = payouts.filter((p: any) => p.status === 'PAID').reduce((sum: number, p: any) => sum + p.amount, 0)
    const outstandingBalance = grossRevenue - totalPayouts
    const lastPayoutDate = payouts.filter((p: any) => p.status === 'PAID').sort((a: any, b: any) => b.paidAt - a.paidAt)[0]?.paidAt || null

    // Get average product rating
    const productReviews = await getPrisma().productReview.aggregate({
      where: {
        productId: { in: productIds }
      },
      _avg: {
        rating: true
      },
      _count: {
        rating: true
      }
    })

    // Get best-selling products (top 5 by quantity sold in paid completed orders)
    const bestSellers = await getPrisma().orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        order: {
          paymentStatus: 'PAID',
          status: { in: ['COMPLETED', 'DELIVERED'] }
        }
      },
      _sum: {
        quantity: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: 5
    })

    // Get product details for best sellers
    const bestSellerIds = bestSellers.map((b: { productId: string; _sum: { quantity: number | null } }) => b.productId)
    const bestSellerProducts = await getPrisma().product.findMany({
      where: { id: { in: bestSellerIds } },
      select: { id: true, name: true }
    })

    const bestSellersWithNames = bestSellers.map((b: { productId: string; _sum: { quantity: number | null } }) => ({
      productId: b.productId,
      productName: bestSellerProducts.find((p: { id: string; name: string }) => p.id === b.productId)?.name || 'Unknown Product',
      totalSold: b._sum.quantity || 0
    }))

    return NextResponse.json({
      productCount,
      activeOrderCount,
      revenue,
      vendorEarnings: totalVendorEarnings,
      averageRating: productReviews._avg.rating || 0,
      totalReviews: productReviews._count.rating || 0,
      bestSellers: bestSellersWithNames,
      totalPaidOrders: totalOrders,
      hasStore,
      hasCategory,
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      grossRevenue,
      totalPayouts,
      outstandingBalance,
      lastPayoutDate,
      verificationStatus: application?.status || 'NOT_APPLIED',
    })
  } catch (error) {
    console.error('Error fetching vendor metrics:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      productCount: 0,
      activeOrderCount: 0,
      revenue: 0,
      vendorEarnings: 0,
      averageRating: 0,
      totalReviews: 0,
      bestSellers: [],
      totalPaidOrders: 0,
      hasStore: false,
      hasCategory: false,
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      grossRevenue: 0,
      totalPayouts: 0,
      outstandingBalance: 0,
      lastPayoutDate: null,
      verificationStatus: 'NOT_APPLIED',
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}