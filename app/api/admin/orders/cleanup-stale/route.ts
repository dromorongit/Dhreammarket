import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { releaseStock } from '@/lib/stock-reservation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/admin/orders/cleanup-stale
export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin()
    if (adminUser instanceof NextResponse) {
      return adminUser
    }

    const prisma = getPrisma()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const staleOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        paymentStatus: 'PENDING',
        vendorAccepted: false,
        vendorRejected: false,
        createdAt: { lt: twentyFourHoursAgo },
        deletedAt: null,
      },
      select: { id: true, userId: true },
    })

    let stockReleased = 0
    let stockReleaseFailed = 0

    for (const order of staleOrders) {
      const result = await releaseStock(order.id, adminUser.userId)
      if (result.success) {
        stockReleased++
      } else {
        stockReleaseFailed++
      }
    }

    const updateResult = await prisma.order.updateMany({
      where: {
        id: { in: staleOrders.map((o) => o.id) },
        status: 'PENDING',
        paymentStatus: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
      },
    })

    return NextResponse.json({
      message: 'Stale order cleanup completed',
      cleanedOrders: updateResult.count,
      stockReleased,
      stockReleaseFailed,
    })
  } catch (error) {
    console.error('Cleanup stale orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
