import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { rateLimit } from '@/lib/rate-limit'

const prisma = getPrisma()

export const dynamic = 'force-dynamic'

// GET all payments with optional filters
export async function GET(request: NextRequest) {
  const rateLimitCheck = rateLimit('admin-orders')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    
    if (status && ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(status)) {
      where.status = status
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
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
            },
          },
          order: {
            select: {
              id: true,
              total: true,
              status: true,
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    // Calculate total revenue from paid payments using aggregation
    const totalRevenueResult = await prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    })

    const totalRevenue = totalRevenueResult._sum.amount || 0

    // Payment status summary
    const summary = await prisma.payment.groupBy({
      by: ['status'],
      _count: true,
    })

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      summary: {
        byStatus: summary,
        totalRevenue,
      },
    })
  } catch (error) {
    console.error('Admin payments error:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}