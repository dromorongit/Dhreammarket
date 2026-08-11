import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { syncStoreRating } from '@/lib/rating-sync'

// Valid order statuses for review eligibility
const VALID_REVIEW_STATUSES = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as any

/**
 * Resolve a raw URL param (which may be a store slug OR a store id) to the
 * store's actual database id. All subsequent related queries MUST use this
 * resolved id rather than the raw param, since the param can be either a slug
 * (e.g. "dhronetech-solutions") or a CUID id depending on what the visitor typed.
 */
async function resolveStoreId(idOrSlug: string): Promise<{ id: string; userId: string; averageRating: number; reviewCount: number } | null> {
  const store = await getPrisma().store.findUnique({
    where: { slug: idOrSlug },
    select: {
      id: true,
      userId: true,
      averageRating: true,
      reviewCount: true,
    },
  })
  if (store) return store

  return await getPrisma().store.findUnique({
    where: { id: idOrSlug },
    select: {
      id: true,
      userId: true,
      averageRating: true,
      reviewCount: true,
    },
  })
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const checkEligibility = request.nextUrl.searchParams.get('checkEligibility') === 'true'
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '10') || 10))
    const sortBy = ['newest', 'oldest', 'highest_rating', 'lowest_rating'].includes(request.nextUrl.searchParams.get('sortBy') || 'newest')
      ? request.nextUrl.searchParams.get('sortBy')!
      : 'newest'

    const idOrSlug = params.id
    if (!idOrSlug) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Resolve the slug-or-id to the actual store id before any related query
    if (checkEligibility) {
      const store = await resolveStoreId(idOrSlug)
      if (!store) {
        return NextResponse.json({ canReview: false }, { status: 200 })
      }

      const token = request.cookies.get('token')?.value
      if (!token) {
        return NextResponse.json({ canReview: false }, { status: 200 })
      }

      const payload = await verifyToken(token)
      if (!payload || payload.role !== 'CUSTOMER') {
        return NextResponse.json({ canReview: false }, { status: 200 })
      }

      // Check if user already reviewed this vendor
      const existingReview = await getPrisma().vendorReview.findUnique({
        where: {
          userId_storeId: {
            storeId: store.id,
            userId: payload.userId,
          },
        },
        include: {
          user: {
            select: {
              profile: { select: { firstName: true } },
            },
          },
          order: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      })

      if (existingReview) {
        return NextResponse.json({
          canReview: false,
          reason: 'already_reviewed',
          userReview: {
            id: existingReview.id,
            rating: existingReview.rating,
            comment: existingReview.comment,
            createdAt: existingReview.createdAt,
            isVerifiedPurchase: existingReview.order !== null,
            reviewer: existingReview.user.profile?.firstName || 'Anonymous',
          }
        }, { status: 200 })
      }

      // Check if user has purchased from this vendor in a valid order
      const validOrder = await getPrisma().orderItem.findFirst({
        where: {
          product: {
            storeId: store.id,
          },
          order: {
            userId: payload.userId,
            paymentStatus: 'PAID',
            status: {
              in: VALID_REVIEW_STATUSES,
            },
          },
        },
      })

      return NextResponse.json({ canReview: !!validOrder, reason: validOrder ? null : 'no_valid_order' }, { status: 200 })
    }

    const store = await resolveStoreId(idOrSlug)

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Build sorting
    let orderBy: any = { createdAt: 'desc' }
    if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' }
    } else if (sortBy === 'highest_rating') {
      orderBy = { rating: 'desc' }
    } else if (sortBy === 'lowest_rating') {
      orderBy = { rating: 'asc' }
    }

    // Get reviews with pagination, only approved and not hidden
    const skip = (page - 1) * limit
    const [reviews, totalReviews] = await Promise.all([
      getPrisma().vendorReview.findMany({
        where: {
          storeId: store.id,
          isApproved: true,
          isHidden: false,
        },
        include: {
          user: {
            select: {
              id: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          order: {
            select: {
              id: true,
              status: true,
              paymentStatus: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      getPrisma().vendorReview.count({
        where: {
          storeId: store.id,
          isApproved: true,
          isHidden: false,
        },
      }),
    ])

    // Calculate star distribution
    const starDistribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    }
    reviews.forEach((review) => {
      starDistribution[review.rating as keyof typeof starDistribution]++
    })

    // Mask user identities for privacy
    const maskedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      isVerifiedPurchase: review.order !== null,
      reviewer: review.user.profile?.firstName || 'Anonymous',
    }))

    const totalPages = Math.ceil(totalReviews / limit)

    return NextResponse.json({
      reviews: maskedReviews,
      averageRating: store.averageRating,
      totalReviews: store.reviewCount,
      starDistribution,
      pagination: {
        page,
        limit,
        total: totalReviews,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching vendor reviews:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Only customers can submit reviews' }, { status: 403 })
    }

    // Resolve the slug-or-id to the actual store id before any related query
    const store = await resolveStoreId(params.id)

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const storeId = store.id
    const { rating, comment } = await request.json()

    // Validate rating is an integer
    if (rating === undefined || rating === null) {
      return NextResponse.json({ error: 'Rating is required' }, { status: 400 })
    }

    if (!Number.isInteger(rating)) {
      return NextResponse.json({ error: 'Rating must be a whole number' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    // Validate comment (required, minimum 5 characters)
    if (!comment || !comment.trim() || comment.trim().length < 5) {
      return NextResponse.json({ error: 'Comment is required and must be at least 5 characters' }, { status: 400 })
    }

    // Anti self-review protection: prevent vendor from reviewing their own store
    if (store.userId === payload.userId) {
      return NextResponse.json({ error: 'You cannot review your own store' }, { status: 400 })
    }

    // Check if user already reviewed this vendor
    const existingReview = await getPrisma().vendorReview.findUnique({
      where: {
        userId_storeId: {
          storeId,
          userId: payload.userId,
        },
      },
    })

    if (existingReview) {
      return NextResponse.json({ error: 'You have already reviewed this vendor' }, { status: 400 })
    }

    // Verify user has purchased from this vendor in a valid order
    const validOrder = await getPrisma().orderItem.findFirst({
      where: {
        product: {
          storeId,
        },
        order: {
          userId: payload.userId,
          paymentStatus: 'PAID',
          status: {
            in: VALID_REVIEW_STATUSES,
          },
        },
      },
    })

    if (!validOrder) {
      return NextResponse.json({
        error: 'You can only review vendors from orders that are PROCESSING, SHIPPED, DELIVERED, or COMPLETED'
      }, { status: 400 })
    }

    // Create review
    const review = await getPrisma().vendorReview.create({
      data: {
        storeId,
        userId: payload.userId,
        rating,
        comment: comment?.trim() || null,
      },
    })

    // Sync cached rating
    await syncStoreRating(storeId)

    return NextResponse.json({ review }, { status: 201 })
  } catch (error) {
    console.error('Error creating vendor review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
