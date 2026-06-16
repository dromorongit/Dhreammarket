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
      return NextResponse.json({ orders: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, error: 'Complete store setup to view orders' }, { status: 403 })
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

    if (!store) {
      return NextResponse.json({ orders: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
    }

    const productIds = store.products?.map((p) => p.id) || []
    
    // If no products, return empty orders
    if (productIds.length === 0) {
      return NextResponse.json({ orders: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
    }

    // Get query parameters for pagination and search
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const orderType = searchParams.get('orderType') || ''
    const fulfillmentStatus = searchParams.get('fulfillmentStatus') || ''

const skip = (page - 1) * limit

    // Build where clause for orders
    const orderWhere: Record<string, unknown> = {
      paymentStatus: { in: ['PAID', 'PENDING'] }, // Show both paid and pending orders to vendors
    }

    // Filter by order status
    if (status && status !== 'all') {
      orderWhere.status = status
    }

    // Filter by order type (PREORDER/BACKORDER)
    if (orderType && orderType !== 'all') {
      orderWhere.orderType = orderType
    }

    // Filter by fulfillment status
    if (fulfillmentStatus && fulfillmentStatus !== 'all') {
      orderWhere.fulfillmentStatus = fulfillmentStatus
    }

    // Search by customer email or order ID
    if (search) {
      orderWhere.OR = [
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { id: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get orders containing vendor's products
    const [orders, total] = await Promise.all([
      getPrisma().order.findMany({
         where: {
           ...orderWhere,
           items: {
             some: {
               productId: { in: productIds },
             },
           },
         },
         include: {
           items: {
             where: {
               productId: { in: productIds },
             },
             include: {
               product: {
                 select: {
                   id: true,
                   name: true,
                   availabilityType: true,
                 },
               },
             },
           },
           user: {
             select: {
               id: true,
               email: true,
               profile: {
                 select: {
                   firstName: true,
                   lastName: true,
                 },
               },
             },
           },
           payment: {
             select: {
               id: true,
               status: true,
               reference: true,
               amount: true,
             },
           },
         },
         orderBy: { createdAt: 'desc' },
         skip,
         take: limit,
       }),
       getPrisma().order.count({
         where: {
           ...orderWhere,
           items: {
             some: {
               productId: { in: productIds },
             },
           },
         },
       }),
     ])

    // Calculate vendor totals for each order
    const ordersWithTotals = orders.map((order) => {
      const vendorTotal = order.items.reduce(
        (sum, item) => sum + (item.price * item.quantity),
        0
      )
      return {
        ...order,
        vendorTotal,
      }
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      orders: ordersWithTotals,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching vendor orders:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    // Return safe defaults even on error to prevent client-side crashes
    return NextResponse.json({ 
      orders: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}