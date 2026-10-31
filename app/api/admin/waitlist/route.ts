import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin()
  if (admin instanceof NextResponse) return admin

  try {
    const prisma = getPrisma()
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const limit = 25
    const search = url.searchParams.get('search')?.trim() || ''
    const interest = url.searchParams.get('interest') || 'all'
    const device = url.searchParams.get('device') || 'all'
    const sort = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest'

    const where: any = {}
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (interest && interest !== 'all') where.interest = interest
    if (device && device !== 'all') where.device = device

    const skip = (page - 1) * limit
    const orderBy = sort === 'oldest' ? { createdAt: 'asc' as const } : { createdAt: 'desc' as const }

    const [items, total] = await Promise.all([
      prisma.waitlistSignup.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.waitlistSignup.count({ where }),
    ])

    // Summary (unfiltered totals)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [totalAll, last7Days, shopping, selling, both, android, ios, bothDev, unknown] = await Promise.all([
      prisma.waitlistSignup.count(),
      prisma.waitlistSignup.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.waitlistSignup.count({ where: { interest: 'shopping' } }),
      prisma.waitlistSignup.count({ where: { interest: 'selling' } }),
      prisma.waitlistSignup.count({ where: { interest: 'both' } }),
      prisma.waitlistSignup.count({ where: { device: 'android' } }),
      prisma.waitlistSignup.count({ where: { device: 'ios' } }),
      prisma.waitlistSignup.count({ where: { device: 'both' } }),
      prisma.waitlistSignup.count({ where: { OR: [{ device: 'unknown' }, { device: null }] } }),
    ])

    const response = NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        total: totalAll,
        last7Days,
        byInterest: { shopping, selling, both },
        byDevice: { android, ios, both: bothDev, unknown },
      },
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('Waitlist list error:', error)
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
}
