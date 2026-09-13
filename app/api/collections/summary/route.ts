import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = outcome

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
    console.error('Error fetching collections summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}