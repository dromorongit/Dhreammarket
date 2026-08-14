import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

const ALLOWED_ENTITY_TYPES = new Set(['PRODUCT', 'SERVICE'])
const ALLOWED_PERIODS = new Set(['today', 'week', 'month'])

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const entityType = searchParams.get('entityType')
    const period = searchParams.get('period') || 'today'

    const now = new Date()
    let dateFilter: Date

    switch (period) {
      case 'today':
        dateFilter = new Date(now.setHours(0, 0, 0, 0))
        break
      case 'week':
        dateFilter = new Date(now.setDate(now.getDate() - 7))
        break
      case 'month':
        dateFilter = new Date(now.setMonth(now.getMonth() - 1))
        break
      default:
        dateFilter = new Date(now.setHours(0, 0, 0, 0))
    }

    const where: any = {
      period,
      recordedAt: { gte: dateFilter },
    }

    if (entityType) {
      where.entityType = entityType
    }

    const recentlySold = await getPrisma().recentlySold.groupBy({
      by: ['entityType', 'entityId'],
      where,
      _sum: { quantity: true },
      _count: true,
      orderBy: { _sum: { quantity: 'desc' } },
      take: 20,
    })

    const entityIds = recentlySold.map((r) => r.entityId)
    const entityMap = new Map()

    if (entityIds.length > 0) {
      const products = await getPrisma().product.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, name: true, price: true, images: { take: 1, select: { url: true } } },
      })
      products.forEach((p) => entityMap.set(p.id, { ...p, type: 'PRODUCT' }))

      const services = await getPrisma().service.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, title: true, startingPrice: true, thumbnail: true },
      })
      services.forEach((s) => entityMap.set(s.id, { ...s, type: 'SERVICE' }))
    }

    const results = recentlySold
      .filter((r) => entityMap.has(r.entityId))
      .map((r) => ({
        ...entityMap.get(r.entityId),
        quantity: r._sum.quantity || 0,
      }))

    return NextResponse.json({ recentlySold: results })
  } catch (error) {
    console.error('Error fetching recently sold:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { entityType, entityId, quantity, period } = await request.json()

    if (!entityType || !ALLOWED_ENTITY_TYPES.has(entityType.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid entityType. Allowed: PRODUCT, SERVICE' }, { status: 400 })
    }

    if (!entityId || typeof entityId !== 'string') {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 })
    }

    const qty = typeof quantity === 'number' ? quantity : parseInt(quantity, 10)
    if (isNaN(qty) || qty < 1 || qty > 10000) {
      return NextResponse.json({ error: 'quantity must be a number between 1 and 10000' }, { status: 400 })
    }

    const normalizedEntityType = entityType.toUpperCase()
    let recordPeriod = period
    if (!recordPeriod || !ALLOWED_PERIODS.has(recordPeriod)) {
      const now = new Date()
      const hour = now.getHours()
      recordPeriod = hour >= 6 ? 'today' : 'yesterday'
    }

    await getPrisma().recentlySold.create({
      data: {
        entityType: normalizedEntityType,
        entityId,
        quantity: qty,
        period: recordPeriod,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording recently sold:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
