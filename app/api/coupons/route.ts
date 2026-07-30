import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { code, type, value, currency, minSpend, maxDiscount, usageLimit, perUserLimit, startDate, expiryDate, description } = await request.json()

    if (!code || !type || value === undefined) {
      return NextResponse.json({ error: 'Code, type, and value are required' }, { status: 400 })
    }

    const coupon = await getPrisma().coupon.create({
      data: {
        code: code.toUpperCase(),
        type: type as any,
        value,
        currency: currency || 'GHS',
        minSpend: minSpend || null,
        maxDiscount: maxDiscount || null,
        usageLimit: usageLimit || null,
        perUserLimit: perUserLimit || 1,
        startDate: startDate ? new Date(startDate) : null,
        expiryDate: new Date(expiryDate),
        description: description || null,
        createdBy: payload.userId,
      },
    })

    return NextResponse.json({ coupon }, { status: 201 })
  } catch (error) {
    console.error('Error creating coupon:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const isPublic = request.nextUrl.searchParams.get('public') === 'true'
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20')
    const activeOnly = request.nextUrl.searchParams.get('activeOnly') === 'true'

    if (!isPublic) {
      const token = request.cookies.get('token')?.value
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const payload = await verifyToken(token)
      if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (isPublic || activeOnly) {
      where.isActive = true
      where.expiryDate = { gte: new Date() }
    }

    const [coupons, total] = await Promise.all([
      getPrisma().coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      getPrisma().coupon.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({ coupons, pagination: { page, limit, total, totalPages } })
  } catch (error) {
    console.error('Error fetching coupons:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}