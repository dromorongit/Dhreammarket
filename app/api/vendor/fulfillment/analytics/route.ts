import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { getVendorDemandAlerts } from '@/lib/fulfillment-events'

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
        preorderCount: 0,
        backorderCount: 0,
        overdueCount: 0,
        avgFulfillmentDays: 0,
      }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
      include: {
        products: { select: { id: true } },
      },
    })

    if (!store) {
      return NextResponse.json({ 
        preorderCount: 0,
        backorderCount: 0,
        overdueCount: 0,
        avgFulfillmentDays: 0,
      })
    }

    const productIds = store.products?.map((p) => p.id) || []

    const [preorderOrders, backorderOrders, overdueOrders, completedOrders] = await Promise.all([
      getPrisma().order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: 'PREORDER',
          items: { some: { productId: { in: productIds } } },
        },
      }),
      getPrisma().order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: 'BACKORDER',
          items: { some: { productId: { in: productIds } } },
        },
      }),
      getPrisma().order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          items: { some: { productId: { in: productIds } } },
          fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK'] },
          OR: [
            {
              items: {
                some: {
                  expectedArrivalDate: { lt: new Date() },
                },
              },
            },
            {
              items: {
                some: {
                  expectedRestockDate: { lt: new Date() },
                },
              },
            },
          ],
        },
      }),
      getPrisma().order.findMany({
        where: {
          paymentStatus: 'PAID',
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          items: { some: { productId: { in: productIds } } },
          status: { in: ['DELIVERED', 'COMPLETED'] },
        },
        select: {
          createdAt: true,
          updatedAt: true,
        },
      }),
    ])

    let avgFulfillmentDays = 0
    if (completedOrders.length > 0) {
      const totalDays = completedOrders.reduce((sum, order) => {
        const days = Math.floor(
          (new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime()) / 
          (1000 * 60 * 60 * 24)
        )
        return sum + days
      }, 0)
      avgFulfillmentDays = Math.round(totalDays / completedOrders.length)
    }

    // Get demand alerts
    const demandAlerts = await getVendorDemandAlerts(payload.userId)

    return NextResponse.json({
      preorderCount: preorderOrders,
      backorderCount: backorderOrders,
      overdueCount: overdueOrders,
      avgFulfillmentDays,
      alerts: demandAlerts.alerts,
    })
  } catch (error) {
    console.error('Error fetching fulfillment analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}