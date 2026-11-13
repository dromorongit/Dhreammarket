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
import {
  VENDOR_ORDER_ITEM_SELECT,
  VENDOR_ORDER_SELECT,
} from '@/lib/public-selects'
import { SaleChannel } from '@prisma/client'

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

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({ orders: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, error: 'Complete store setup to view orders' }, { status: 403 })
    }

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
    
    if (productIds.length === 0) {
      return NextResponse.json({ orders: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = (searchParams.get('search') || '').trim().replace(/^#+/, '')
    const status = searchParams.get('status') || ''
    const orderType = searchParams.get('orderType') || ''
    const fulfillmentStatus = searchParams.get('fulfillmentStatus') || ''
    const source = searchParams.get('source') || ''
    const unpaid = searchParams.get('unpaid') === 'true'
    const channel = searchParams.get('channel') || ''
    const toDispatch = searchParams.get('toDispatch') === 'true'

    const skip = (page - 1) * limit

    const validChannels = Object.values(SaleChannel) as string[]
    const channelFilter = channel && validChannels.includes(channel) ? channel : undefined

    const orderWhere: Record<string, unknown> = {
      deletedAt: null,
      OR: [
        { paymentStatus: 'PAID' },
        { source: 'MANUAL' },
      ],
    }

    const extraFilters: Record<string, unknown>[] = []

    if (status && status !== 'all') {
      extraFilters.push({ status })
    }

    if (source && source !== 'all') {
      extraFilters.push({ source })
    }

    if (unpaid) {
      extraFilters.push({ paymentStatus: { not: 'PAID' }, status: { not: 'CANCELLED' } })
    }

    if (channelFilter) {
      extraFilters.push({ channel: channelFilter })
    }

    if (orderType && orderType !== 'all') {
      extraFilters.push({ orderType })
    }

    if (fulfillmentStatus && fulfillmentStatus !== 'all') {
      extraFilters.push({ fulfillmentStatus })
    }

    if (toDispatch) {
      extraFilters.push({ status: 'PROCESSING' })
    }

    if (search) {
      orderWhere.OR = [
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { id: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (extraFilters.length > 0) {
      orderWhere.AND = extraFilters
    }

    const vendorWhere: Record<string, unknown> = {
      ...orderWhere,
      items: {
        some: {
          productId: { in: productIds },
        },
      },
    }

    const [orders, total] = await Promise.all([
      getPrisma().order.findMany({
        where: vendorWhere,
        select: {
          ...VENDOR_ORDER_SELECT,
          deliveryCost: true,
          items: {
            where: {
              productId: { in: productIds },
            },
            select: {
              ...VENDOR_ORDER_ITEM_SELECT,
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
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      getPrisma().order.count({
        where: vendorWhere,
      }),
    ])

    let counts: { unpaid: number; toDispatch: number } | undefined
    if (page === 1) {
      const countWhere: Record<string, unknown> = {
        deletedAt: null,
        OR: [
          { paymentStatus: 'PAID' },
          { source: 'MANUAL' },
        ],
        items: {
          some: {
            productId: { in: productIds },
          },
        },
      }
      const [unpaidCount, toDispatchCount] = await Promise.all([
        getPrisma().order.count({
          where: {
            ...countWhere,
            paymentStatus: { not: 'PAID' },
            status: { not: 'CANCELLED' },
          },
        }),
        getPrisma().order.count({
          where: {
            ...countWhere,
            status: 'PROCESSING',
          },
        }),
      ])
      counts = { unpaid: unpaidCount, toDispatch: toDispatchCount }
    }

    const pageOrderIds = orders.map((order) => order.id)
    const payments = await getPrisma().payment.findMany({
      where: { orderId: { in: pageOrderIds } },
      select: {
        id: true,
        orderId: true,
        status: true,
        amount: true,
        authorizationUrl: true,
      },
    })
    const paymentMap = new Map(payments.map((p) => [p.orderId, p]))

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
      const {
        customerFirstName: _cfn,
        customerLastName: _cln,
        customerPhone: _cpf,
        paymentMethod: _pm,
        receiptToken: _rt,
        deliveryCost: _dc,
        ...orderRest
      } = order
      const hasOtherVendorItems = otherVendorOrderIds.has(order.id)

      const orderPayment = paymentMap.get(order.id)
      const paymentOutput = orderPayment ? {
        id: orderPayment.id,
        status: orderPayment.status,
        amount: orderPayment.amount,
      } : null
      const payLinkSent = orderPayment?.status === 'PENDING' && !!orderPayment?.authorizationUrl
      const paymentNeedsReview = orderPayment?.status === 'PAID' && order.paymentStatus !== 'PAID'

      const baseRow = {
        ...orderRest,
        vendorTotal,
        source: order.source,
        channel: order.channel,
        hasOtherVendorItems,
        payment: paymentOutput,
        payLinkSent,
        paymentNeedsReview,
      }

      if (order.source === 'MANUAL') {
        const customerName = [order.customerFirstName, order.customerLastName]
          .filter(Boolean)
          .join(' ')

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
          deliveryCost: hasOtherVendorItems ? null : (order.deliveryCost ?? null),
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
      ...(counts ? { counts } : {}),
    })
  } catch (error) {
    console.error('Error fetching vendor orders:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      orders: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}
