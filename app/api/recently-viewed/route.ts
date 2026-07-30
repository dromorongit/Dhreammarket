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
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { entityType, entityId } = await request.json()

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'Entity type and ID are required' }, { status: 400 })
    }

    if (!['PRODUCT', 'SERVICE', 'VENDOR'].includes(entityType)) {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 })
    }

    await getPrisma().recentlyViewed.create({
      data: {
        userId: payload.userId,
        entityType,
        entityId,
      },
    })

    await getPrisma().recentlyViewed.deleteMany({
      where: {
        userId: payload.userId,
        entityType,
        entityId,
        viewedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    })

    await getPrisma().recentlyViewed.deleteMany({
      where: {
        userId: payload.userId,
        viewedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording recently viewed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entityType = request.nextUrl.searchParams.get('entityType')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20')

    const where: Record<string, unknown> = { userId: payload.userId }
    if (entityType) {
      where.entityType = entityType
    }

    const recent = await getPrisma().recentlyViewed.findMany({
      where,
      select: { entityType: true, entityId: true, viewedAt: true },
      orderBy: { viewedAt: 'desc' },
      take: limit,
    })

    const deduped = new Map<string, any>()
    for (const item of recent) {
      const key = `${item.entityType}_${item.entityId}`
      if (!deduped.has(key)) {
        deduped.set(key, item)
      }
    }

    const items = Array.from(deduped.values())
    
    for (const item of items) {
      if (item.entityType === 'PRODUCT') {
        const product = await getPrisma().product.findUnique({
          where: { id: item.entityId },
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            salesPrice: true,
            dealsPrice: true,
            images: { take: 1, select: { url: true } },
            store: { select: { name: true } },
          },
        })
        if (product) {
          item.product = {
            ...product,
            image: product.images?.[0]?.url || null,
          }
        }
      } else if (item.entityType === 'SERVICE') {
        const service = await getPrisma().service.findUnique({
          where: { id: item.entityId },
          select: {
            id: true,
            title: true,
            slug: true,
            startingPrice: true,
            thumbnail: true,
            store: { select: { name: true } },
          },
        })
        if (service) {
          item.service = service
        }
      }
    }

    return NextResponse.json({
      recentlyViewed: items,
    })
  } catch (error) {
    console.error('Error fetching recently viewed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}