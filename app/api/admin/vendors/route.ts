import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET all vendors with optional verification filter
export async function GET(request: NextRequest) {
  try {
    const prisma = getPrisma()
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const verified = searchParams.get('verified')
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      user: { role: 'VENDOR' },
    }
    
    if (verified !== null) {
      where.isVerified = verified === 'true'
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Get stores and their product IDs for revenue calculation
    const storesWithProducts = await prisma.store.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
        products: {
          select: { id: true },
        },
        _count: {
          select: { products: true },
        },
      },
    })

    const total = await prisma.store.count({ where })
    const totalPages = Math.ceil(total / limit)

    // Fetch revenue and payout data for each vendor
    const vendorsWithMetrics = await Promise.all(storesWithProducts.map(async (store) => {
      const productIds = store.products.map(p => p.id)
      
      // Calculate gross revenue from completed/paid orders
      let grossRevenue = 0
      let outstandingBalance = 0
      if (productIds.length > 0) {
        const orderItems = await prisma.orderItem.findMany({
          where: {
            productId: { in: productIds },
            order: {
              paymentStatus: 'PAID',
              status: { in: ['COMPLETED', 'DELIVERED'] },
            },
          },
          select: {
            price: true,
            quantity: true,
            vendorEarnings: true,
          },
        })
        
        grossRevenue = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        outstandingBalance = orderItems.reduce((sum, item) => sum + (item.vendorEarnings || 0), 0)
      }

      // Get total payouts for this vendor
      const totalPayouts = await prisma.vendorPayout.aggregate({
        where: {
          vendorId: store.userId,
          status: 'PAID',
        },
        _sum: { amount: true },
      })

      const paidOut = totalPayouts._sum.amount || 0
      outstandingBalance = Math.max(0, outstandingBalance - paidOut)

return {
          id: store.id,
          name: store.name,
          description: store.description,
          isVerified: store.isVerified,
          isFeatured: store.isFeatured,
          badgeTier: store.badgeTier,
          featuredUntil: store.featuredUntil ? store.featuredUntil.toISOString() : null,
          createdAt: store.user.createdAt,
          mobileNumber: store.mainPhoneNumber,
          location: store.location,
          user: {
            id: store.user.id,
            email: store.user.email,
            role: store.user.role,
            createdAt: store.user.createdAt,
          },
          _count: {
            products: store._count.products,
          },
          grossRevenue,
          totalPayouts: paidOut,
          outstandingBalance,
        }
    }))

    const vendors = vendorsWithMetrics

    return NextResponse.json({
      vendors,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Admin vendors error:', error)
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 })
  }
}