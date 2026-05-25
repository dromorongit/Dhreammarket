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
    if (!isOnboarded) {
      return NextResponse.json({
        productCount: 0,
        activeOrderCount: 0,
        revenue: 0,
        vendorEarnings: 0,
        averageRating: 0,
        totalReviews: 0,
        bestSellers: [],
        totalPaidOrders: 0
      })
    }

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
        totalPaidOrders: 0
      })
    }

    const productIds = store.products?.map((p: { id: string }) => p.id) || []
    const productCount = productIds.length

    if (productIds.length === 0) {
      return NextResponse.json({
        productCount: 0,
        activeOrderCount: 0,
        revenue: 0,
        vendorEarnings: 0,
        averageRating: 0,
        totalReviews: 0,
        bestSellers: [],
        totalPaidOrders: 0
      })
    }

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
     const completedOrders = await getPrisma().orderItem.findMany({
       where: {
         productId: { in: productIds },
         order: {
           status: 'COMPLETED',
           paymentStatus: 'PAID' // Only count paid orders in revenue
         }
       },
       select: {
         vendorEarnings: true
       }
     })
 
     // Calculate total vendor earnings (already has commission deducted)
     let totalVendorEarnings = 0
     for (const item of completedOrders) {
       if (item.vendorEarnings !== null) {
         totalVendorEarnings += item.vendorEarnings
       }
     }
 
     // For backward compatibility, also calculate gross revenue
     const grossRevenueOrders = await getPrisma().orderItem.findMany({
       where: {
         productId: { in: productIds },
         order: {
           status: 'COMPLETED',
           paymentStatus: 'PAID' // Only count paid orders in revenue
         }
       },
       select: {
         price: true,
         quantity: true
       }
     })
 
     const revenue = grossRevenueOrders.reduce((total: number, item: { price: number; quantity: number }) => {
       return total + (item.price * item.quantity)
     }, 0)

    // Get average product rating
    const productReviews = await getPrisma().review.aggregate({
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
       totalPaidOrders: activeOrders.length + completedOrders.length
     })
  } catch (error) {
    console.error('Error fetching vendor metrics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}