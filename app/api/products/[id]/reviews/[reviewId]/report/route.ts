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
    const { reason, comment } = await request.json()

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
    }

    const existing = await getPrisma().reviewReport.findFirst({
      where: { reviewId, userId: payload.userId },
    })

    if (existing) {
      return NextResponse.json({ error: 'You have already reported this review' }, { status: 400 })
    }

    const report = await getPrisma().reviewReport.create({
      data: {
        reviewId,
        userId: payload.userId,
        reason,
        comment: comment?.trim() || null,
      },
    })

    return NextResponse.json({ report }, { status: 201 })
  } catch (error) {
    console.error('Error reporting review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}