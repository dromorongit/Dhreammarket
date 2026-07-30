import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

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

    const collectionsWithCounts = await Promise.all(
      collections.map(async (c) => {
        const itemCount = await getPrisma().collectionItem.count({
          where: { collectionId: c.id },
        })
        return { ...c, itemCount }
      })
    )

    return NextResponse.json({ collections: collectionsWithCounts })
  } catch (error) {
    console.error('Error fetching collections summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}