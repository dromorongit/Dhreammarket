import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

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
    const { entityType, entityId, quantity, period } = await request.json()

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
    }

    const now = new Date()
    let recordPeriod = period
    if (!recordPeriod) {
      const hour = now.getHours()
      recordPeriod = hour >= 6 ? 'today' : 'yesterday'
    }

    await getPrisma().recentlySold.create({
      data: {
        entityType,
        entityId,
        quantity: quantity || 1,
        period: recordPeriod,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording recently sold:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
