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

    const { name, slug, description, isPublic } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Collection name is required' }, { status: 400 })
    }

    const collectionSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-6)

    const existing = await getPrisma().collection.findUnique({
      where: { slug: collectionSlug },
    })
    if (existing) {
      return NextResponse.json({ error: 'Collection slug already exists' }, { status: 400 })
    }

    const collection = await getPrisma().collection.create({
      data: {
        userId: payload.userId,
        name: name.trim(),
        slug: collectionSlug,
        description: description?.trim() || null,
        isPublic: isPublic ?? false,
      },
    })

    return NextResponse.json({ collection }, { status: 201 })
  } catch (error) {
    console.error('Error creating collection:', error)
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

    const collections = await getPrisma().collection.findMany({
      where: { userId: payload.userId },
      select: {
        id: true, name: true, slug: true, description: true, isPublic: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const collectionIds = collections.map((c) => c.id)
    const countsResult = collectionIds.length > 0
      ? await getPrisma().collectionItem.groupBy({
          by: ['collectionId'],
          where: { collectionId: { in: collectionIds } },
          _count: { id: true },
        })
      : []

    const countMap = new Map(countsResult.map((r) => [r.collectionId, r._count.id]))
    const collectionsWithCounts = collections.map((c) => ({
      ...c,
      itemCount: countMap.get(c.id) || 0,
    }))

    return NextResponse.json({ collections: collectionsWithCounts })
  } catch (error) {
    console.error('Error fetching collections:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { collectionId, name, description, isPublic } = await request.json()

    const collection = await getPrisma().collection.findUnique({
      where: { id: collectionId },
    })

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    if (collection.userId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await getPrisma().collection.update({
      where: { id: collectionId },
      data: {
        name: name?.trim() || collection.name,
        description: description?.trim() || collection.description,
        isPublic: isPublic ?? collection.isPublic,
      },
    })

    return NextResponse.json({ collection: updated })
  } catch (error) {
    console.error('Error updating collection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { collectionId } = await request.json()

    if (!collectionId) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 })
    }

    const collection = await getPrisma().collection.findUnique({
      where: { id: collectionId },
      select: { userId: true },
    })

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    if (collection.userId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await getPrisma().collection.delete({ where: { id: collectionId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting collection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}