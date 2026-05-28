import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { syncProductRating } from '@/lib/rating-sync'

export async function PUT(request: NextRequest, { params }: { params: { id: string; reviewId: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Only customers can edit reviews' }, { status: 403 })
    }

    const { rating, comment } = await request.json()

    // Validate rating is an integer if provided
    if (rating !== undefined && rating !== null) {
      if (!Number.isInteger(rating)) {
        return NextResponse.json({ error: 'Rating must be a whole number (1-5)' }, { status: 400 })
      }
      if (rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
      }
    }

    // Find the review and verify ownership
    const existingReview = await getPrisma().productReview.findUnique({
      where: { id: params.reviewId },
    })

    if (!existingReview) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    if (existingReview.userId !== payload.userId) {
      return NextResponse.json({ error: 'You can only edit your own reviews' }, { status: 403 })
    }

    // Update the review
    const review = await getPrisma().productReview.update({
      where: { id: params.reviewId },
      data: {
        rating: rating ?? existingReview.rating,
        comment: comment?.trim() ?? existingReview.comment,
      },
    })

    // Sync cached rating after update
    await syncProductRating(params.id)

    return NextResponse.json({ review })
  } catch (error) {
    console.error('Error updating review:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; reviewId: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Only customers can delete reviews' }, { status: 403 })
    }

    // Find the review and verify ownership
    const existingReview = await getPrisma().productReview.findUnique({
      where: { id: params.reviewId },
    })

    if (!existingReview) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    if (existingReview.userId !== payload.userId) {
      return NextResponse.json({ error: 'You can only delete your own reviews' }, { status: 403 })
    }

    // Delete the review
    await getPrisma().productReview.delete({
      where: { id: params.reviewId },
    })

    // Sync cached rating after deletion
    await syncProductRating(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting review:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage 
    }, { status: 500 })
  }
}