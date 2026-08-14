import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { sanitizeUserContent } from '@/lib/sanitize'
import { createNotification } from '@/lib/notifications'

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

    const review = await getPrisma().productReview.findUnique({
      where: { id: reviewId },
    })

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    const sanitizedComment = comment ? sanitizeUserContent(comment, { maxLength: 1000 }) : null

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
        comment: sanitizedComment,
      },
    })

    const adminUsers = await getPrisma().user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true },
    })

    for (const admin of adminUsers) {
      await createNotification(
        admin.id,
        'REVIEW_REPORTED',
        'Review Reported',
        `A review has been flagged for moderation. Reason: ${reason}`
      )
    }

    return NextResponse.json({ report }, { status: 201 })
  } catch (error) {
    console.error('Error reporting review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}