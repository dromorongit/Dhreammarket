import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest, { params }: { params: { id: string; reviewId: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reviewId } = params
    const existing = await getPrisma().reviewLike.findUnique({
      where: { reviewId_userId: { reviewId, userId: payload.userId } },
    })

    if (existing) {
      await getPrisma().reviewLike.delete({ where: { id: existing.id } })
      return NextResponse.json({ liked: false })
    }

    await getPrisma().reviewLike.create({
      data: { reviewId, userId: payload.userId },
    })

    return NextResponse.json({ liked: true })
  } catch (error) {
    console.error('Error toggling review like:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}