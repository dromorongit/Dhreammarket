import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
const prisma = getPrisma()
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET all orders with optional filters
export async function GET(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const paymentStatus = searchParams.get('paymentStatus')
    const orderType = searchParams.get('orderType')
    const fulfillmentStatus = searchParams.get('fulfillmentStatus')

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      deletedAt: null, // Exclude soft-deleted orders by default
    }
    
    if (status && ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      where.status = status
    }

    if (orderType && ['NORMAL', 'PREORDER', 'BACKORDER'].includes(orderType)) {
      where.orderType = orderType
    }
    
    if (paymentStatus && ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(paymentStatus)) {
      where.paymentStatus = paymentStatus
    }

    if (fulfillmentStatus && ['PENDING', 'AWAITING_STOCK', 'AWAITING_RESTOCK', 'READY_TO_FULFILL', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(fulfillmentStatus)) {
      where.fulfillmentStatus = fulfillmentStatus
    }

const [orders, total] = await Promise.all([
       prisma.order.findMany({
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
               profile: {
                 select: {
                   firstName: true,
                   lastName: true,
                   phone: true,
                 },
               },
             },
           },
           items: {
             select: {
               id: true,
               quantity: true,
               price: true,
               product: {
                 select: {
                   store: {
                     select: {
                       id: true,
                       name: true,
                       mainPhoneNumber: true,
                     },
                   },
                 },
               },
             },
           },
           _count: {
             select: { items: true },
           },
           payment: {
             select: {
               id: true,
               status: true,
               amount: true,
               reference: true,
             },
           },
         },
       }),
       prisma.order.count({ where }),
     ])

    const ordersWithDaysOutstanding = orders.map((order) => ({
          ...order,
       daysOutstanding: order.orderType !== 'NORMAL' 
         ? Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24))
         : undefined,
     }))

    const totalPages = Math.ceil(total / limit)

    // Calculate summary stats
    const summary = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
    })

    const paymentSummary = await prisma.order.groupBy({
      by: ['paymentStatus'],
      _count: true,
    })

return NextResponse.json({
      orders: ordersWithDaysOutstanding.map((order) => {
        // Extract unique store names from order items
        const storeNames = Array.from(new Set(
          order.items.map(item => item.product?.store?.name).filter(Boolean)
        ))
        
        // Get customer name with fallback hierarchy
        const customerName = [
          order.user.profile?.firstName,
          order.user.profile?.lastName,
        ].filter(Boolean).join(' ') || order.user.email
        
        // Get vendor contact from first item's store
        const vendorContact = order.items[0]?.product?.store?.mainPhoneNumber || null
        
        return {
          ...order,
          vendorAccepted: order.vendorAccepted,
          vendorRejected: order.vendorRejected,
          customerName,
          storeNames: storeNames.length > 0 ? storeNames : null,
          vendorContact,
        }
      }),
       pagination: {
         page,
         limit,
         total,
         totalPages,
       },
      summary: {
        byStatus: summary,
        byPaymentStatus: paymentSummary,
      },
    })
  } catch (error) {
    console.error('Admin orders error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

// DELETE - Soft delete an order
export async function DELETE(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Soft delete by setting deletedAt
    await prisma.order.update({
      where: { id: orderId },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ success: true, message: 'Order deleted successfully' })
  } catch (error) {
    console.error('Admin order delete error:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}