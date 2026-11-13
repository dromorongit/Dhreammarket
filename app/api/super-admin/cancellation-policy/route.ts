import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '50', 10)))
    const skip = (page - 1) * pageSize

    const [cancellations, totalCount] = await Promise.all([
      prisma.customerCancellation.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderId: true,
          feeAmount: true,
          refundAmount: true,
          createdAt: true,
          user: { select: { id: true, email: true } },
          order: { select: { id: true, total: true, paymentStatus: true, createdAt: true } },
        },
      }),
      prisma.customerCancellation.count(),
    ])

    const aggregates = cancellations.reduce(
      (acc, row) => ({
        totalFeeAmount: acc.totalFeeAmount + Number(row.feeAmount || 0),
        totalRefundAmount: acc.totalRefundAmount + Number(row.refundAmount || 0),
      }),
      { totalFeeAmount: 0, totalRefundAmount: 0 }
    )

    return NextResponse.json({
      cancellations,
      totals: {
        totalFeeAmount: aggregates.totalFeeAmount,
        totalRefundAmount: aggregates.totalRefundAmount,
      },
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    })
  } catch (error) {
    console.error('Super Admin cancellation policy list error:', error)
    return NextResponse.json({ error: 'Failed to fetch cancellation policy records' }, { status: 500 })
  }
}
