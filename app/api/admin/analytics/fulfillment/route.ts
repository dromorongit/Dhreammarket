import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [waitingPreorders, waitingBackorders, allocatedToday, readyToFulfill, avgWaitingDaysResult] = await Promise.all([
      getPrisma().order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: 'PREORDER',
          fulfillmentStatus: 'AWAITING_STOCK',
        },
      }),
      getPrisma().order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: 'BACKORDER',
          fulfillmentStatus: 'AWAITING_RESTOCK',
        },
      }),
      getPrisma().order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          allocatedAt: { gte: today, lt: tomorrow },
        },
      }),
      getPrisma().order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          fulfillmentStatus: 'READY_TO_FULFILL',
        },
      }),
      getPrisma().order.findMany({
        where: {
          paymentStatus: 'PAID',
          orderType: { in: ['PREORDER', 'BACKORDER'] },
          fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK', 'READY_TO_FULFILL'] },
        },
        select: {
          createdAt: true,
          allocatedAt: true,
        },
      }),
    ])

    let avgWaitingDays = 0
    const waitingOrders = avgWaitingDaysResult.filter(o => !o.allocatedAt)
    if (waitingOrders.length > 0) {
      const totalDays = waitingOrders.reduce((sum, order) => {
        const days = Math.floor(
          (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        )
        return sum + days
      }, 0)
      avgWaitingDays = Math.round(totalDays / waitingOrders.length)
    }

    return NextResponse.json({
      waitingPreorders,
      waitingBackorders,
      allocatedToday,
      readyToFulfill,
      avgWaitingDays,
    })
  } catch (error) {
    console.error('Error fetching admin fulfillment analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}