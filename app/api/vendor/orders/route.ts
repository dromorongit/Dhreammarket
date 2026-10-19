import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { buildReceiptUrl, orderDisplayNumber } from '@/lib/manual-orders'
import {
  fromPesewas,
  orderCogsPesawas,
  toPesewas,
  PROFIT_LABEL,
} from '@/lib/sales-summary'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

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
    const search = (searchParams.get('search') || '').trim().replace(/^#+/, '')
    const status = searchParams.get('status') || ''
    const orderType = searchParams.get('orderType') || ''
    const fulfillmentStatus = searchParams.get('fulfillmentStatus') || ''
    const source = searchParams.get('source') || ''
    const unpaid = searchParams.get('unpaid') === 'true'

const skip = (page - 1) * limit

    // Build where clause for orders
    const orderWhere: Record<string, unknown> = {
      deletedAt: null, // Exclude soft-deleted orders
      // Show paid online orders and all manual (off-platform) orders.
      OR: [
        { paymentStatus: 'PAID' },
        { source: 'MANUAL' },
      ],
    }

    // Filter by order status
    if (status && status !== 'all') {
      orderWhere.status = status
    }

    // Filter by order source (ONLINE / MANUAL)
    if (source && source !== 'all') {
      orderWhere.source = source
    }

    // Filter by unpaid only
    if (unpaid) {
      orderWhere.paymentStatus = { not: 'PAID' }
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
                    costPrice: true,
                  },
                },
                productVariant: {
                  select: {
                    id: true,
                    costPrice: true,
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
    const pageOrderIds = orders.map((order) => order.id)
    const otherVendorItems = await getPrisma().orderItem.findMany({
      where: {
        orderId: { in: pageOrderIds },
        productId: { notIn: productIds },
      },
      select: { orderId: true },
    })
    const otherVendorOrderIds = new Set(otherVendorItems.map((item) => item.orderId))

    const ordersWithTotals = orders.map((order) => {
      const vendorTotal = order.items.reduce(
        (sum, item) => sum + (item.price * item.quantity),
        0
      )
      // Manual-only fields should not appear on ONLINE rows.
      const {
        customerFirstName: _cfn,
        customerLastName: _cln,
        customerPhone: _cpf,
        paymentMethod: _pm,
        receiptToken: _rt,
        ...orderRest
      } = order
      const baseRow = {
        ...orderRest,
        vendorTotal,
        source: order.source,
        channel: order.channel,
        hasOtherVendorItems: otherVendorOrderIds.has(order.id),
      }

      // Additive fields for MANUAL orders only — ONLINE rows are unchanged.
      if (order.source === 'MANUAL') {
        const customerName = [order.customerFirstName, order.customerLastName]
          .filter(Boolean)
          .join(' ')

        // Profit for a manual sale: the order total, minus what the items
        // cost, minus what the vendor paid the rider. It is only reported
        // when every line has a known cost, so the vendor is never shown a
        // profit that silently ignores missing cost prices.
        const cost = orderCogsPesawas({
          id: order.id,
          source: 'MANUAL',
          channel: order.channel,
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          total: order.total,
          vendorEarnings: null,
          netAmount: null,
          deliveryCost: order.deliveryCost ?? null,
          items: (order.items || []).map((item: any) => ({
            id: item.id,
            productId: item.productId,
            productVariantId: item.productVariantId ?? null,
            productName: item.product?.name ?? 'Product',
            variantLabel: null,
            quantity: item.quantity,
            price: item.price,
            costPriceSnapshot: item.costPriceSnapshot ?? null,
            variantCostPrice: item.productVariant?.costPrice ?? null,
            productCostPrice: item.product?.costPrice ?? null,
            vendorEarnings: null,
          })),
        })
        const costComplete = cost.missingCostItems === 0
        const deliveryCostKnown = order.deliveryCost !== null && order.deliveryCost !== undefined
        const revenuePesawas = toPesewas(order.total)
        const deliveryCostPesawas = deliveryCostKnown
          ? toPesewas(order.deliveryCost as number)
          : 0
        const profitPesawas = revenuePesawas - cost.cogsPesawas - deliveryCostPesawas

        return {
          ...baseRow,
          displayNumber: orderDisplayNumber(order.id),
          customerName,
          customerPhone: order.customerPhone || null,
          paymentMethod: order.paymentMethod || null,
          receiptToken: order.receiptToken || null,
          receiptUrl: order.receiptToken ? buildReceiptUrl(order.receiptToken) : null,
          deliveryCost: order.deliveryCost ?? null,
          cost: costComplete ? fromPesewas(cost.cogsPesawas) : null,
          profit: costComplete ? fromPesewas(profitPesawas) : null,
          profitLabel: PROFIT_LABEL,
          costComplete,
          deliveryCostKnown,
        }
      }

      return baseRow
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