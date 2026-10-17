import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

function toTwoDecimals(value: number | null): number {
  return Number((value || 0).toFixed(2))
}

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
      return NextResponse.json(
        { error: 'Complete store setup to view customers' },
        { status: 403 }
      )
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100)
    const skip = (page - 1) * limit
    const search = (searchParams.get('search') || '').trim()

    const where: any = { storeId: store.id }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [customers, total] = await Promise.all([
      getPrisma().vendorCustomer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, name: true, phone: true, email: true, tags: true, notes: true,
          firstChannel: true, createdAt: true, updatedAt: true,
        },
      }),
      getPrisma().vendorCustomer.count({ where }),
    ])

    const prisma = getPrisma()
    const customerIds = customers.map((c) => c.id)

    let allStats: any[] = []
    let paidStats: any[] = []
    if (customerIds.length > 0) {
      ;[allStats, paidStats] = await Promise.all([
        prisma.order.groupBy({
          by: ['vendorCustomerId'],
          where: {
            vendorCustomer: { storeId: store.id, id: { in: customerIds } },
            deletedAt: null,
          },
          _count: { id: true },
          _max: { createdAt: true },
        }),
        prisma.order.groupBy({
          by: ['vendorCustomerId'],
          where: {
            vendorCustomer: { storeId: store.id, id: { in: customerIds } },
            status: { not: 'CANCELLED' },
            paymentStatus: 'PAID',
          },
          _sum: { total: true },
        }),
      ])
    }

    const statsByCustomer = new Map<string, { orderCount: number; totalSpent: number; lastOrderAt: Date | null }>()
    for (const stat of allStats) {
      if (!stat.vendorCustomerId) continue
      const paid = paidStats.find((p) => p.vendorCustomerId === stat.vendorCustomerId)
      statsByCustomer.set(stat.vendorCustomerId, {
        orderCount: stat._count.id,
        totalSpent: toTwoDecimals(paid?._sum.total || null),
        lastOrderAt: stat._max.createdAt,
      })
    }

    const latestOrders = await prisma.order.findMany({
      where: { vendorCustomerId: { in: customerIds }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, vendorCustomerId: true },
    })

    const latestOrderByCustomer = new Map<string, string>()
    for (const order of latestOrders) {
      if (!order.vendorCustomerId || latestOrderByCustomer.has(order.vendorCustomerId)) continue
      latestOrderByCustomer.set(order.vendorCustomerId, order.id)
    }

    const latestOrderIds = Array.from(latestOrderByCustomer.values())
    let itemsByOrder = new Map<string, Array<{ productId: string; productName: string; quantity: number; unitPrice: number }>>()
    if (latestOrderIds.length > 0) {
      const items = await prisma.orderItem.findMany({
        where: { orderId: { in: latestOrderIds } },
        include: { product: { select: { id: true, name: true } } },
      })
      for (const item of items) {
        const list = itemsByOrder.get(item.orderId) || []
        list.push({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.price,
        })
        itemsByOrder.set(item.orderId, list)
      }
    }

    const enriched = customers.map((customer) => {
      const stats = statsByCustomer.get(customer.id) || {
        orderCount: 0,
        totalSpent: 0,
        lastOrderAt: null,
      }
      const lastOrderId = latestOrderByCustomer.get(customer.id)
      return {
        ...customer,
        ...stats,
        lastOrderedItems: lastOrderId ? (itemsByOrder.get(lastOrderId) || []) : [],
      }
    })

    return NextResponse.json({
      customers: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching vendor customers:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    )
  }
}
