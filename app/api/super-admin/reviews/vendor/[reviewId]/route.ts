import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { syncStoreRating } from '@/lib/rating-sync'

// PATCH - approve, hide, or delete a vendor review
export async function PATCH(
  request: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - SUPER_ADMIN access required' }, { status: 403 })
    }

    const { action } = await request.json()

    if (!action || !['approve', 'hide', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be approve, hide, or delete' }, { status: 400 })
    }

    // Get the review to find the store
    const review = await getPrisma().vendorReview.findUnique({
      where: { id: params.reviewId },
    })

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    if (action === 'delete') {
      await getPrisma().vendorReview.delete({
        where: { id: params.reviewId },
      })
      // Sync cached rating after deletion
      await syncStoreRating(review.storeId)
      return NextResponse.json({ success: true, message: 'Review deleted' })
    }

    if (action === 'approve') {
      await getPrisma().vendorReview.update({
        where: { id: params.reviewId },
        data: { isApproved: true, isHidden: false },
      })
      // Sync cached rating after approval
      await syncStoreRating(review.storeId)
      return NextResponse.json({ success: true, message: 'Review approved' })
    }

    if (action === 'hide') {
      const currentReview = await getPrisma().vendorReview.findUnique({
        where: { id: params.reviewId },
      })
      
      if (!currentReview) {
        return NextResponse.json({ error: 'Review not found' }, { status: 404 })
      }

      await getPrisma().vendorReview.update({
        where: { id: params.reviewId },
        data: { isHidden: !currentReview.isHidden },
      })
      // Sync cached rating after hide/unhide
      await syncStoreRating(review.storeId)
      return NextResponse.json({ success: true, message: 'Review hidden/unhidden' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating vendor review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}