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

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({
        preorder: { total: 0, byStatus: [] },
        backorder: { total: 0, byStatus: [] },
      })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
      include: {
        products: { select: { id: true } },
      },
    })

    if (!store) {
      return NextResponse.json({
        preorder: { total: 0, byStatus: [] },
        backorder: { total: 0, byStatus: [] },
      })
    }

    const productIds = store.products?.map((p) => p.id) || []

    const [preorderOrders, backorderOrders] = await Promise.all([
      getPrisma().order.findMany({
        where: {
          paymentStatus: 'PAID',
          orderType: 'PREORDER',
          items: { some: { productId: { in: productIds } } },
        },
        select: { fulfillmentStatus: true },
      }),
      getPrisma().order.findMany({
        where: {
          paymentStatus: 'PAID',
          orderType: 'BACKORDER',
          items: { some: { productId: { in: productIds } } },
        },
        select: { fulfillmentStatus: true },
      }),
    ])

    const groupByStatus = (orders: { fulfillmentStatus: string }[]) => {
      const statusCounts: Record<string, number> = {}
      for (const order of orders) {
        statusCounts[order.fulfillmentStatus] = (statusCounts[order.fulfillmentStatus] || 0) + 1
      }
      return Object.entries(statusCounts).map(([status, count]) => ({ status, count }))
    }

    return NextResponse.json({
      preorder: {
        total: preorderOrders.length,
        byStatus: groupByStatus(preorderOrders),
      },
      backorder: {
        total: backorderOrders.length,
        byStatus: groupByStatus(backorderOrders),
      },
    })
  } catch (error) {
    console.error('Error fetching fulfillment analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}