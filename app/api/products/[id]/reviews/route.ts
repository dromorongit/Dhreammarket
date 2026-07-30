import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { syncProductRating } from '@/lib/rating-sync'
import { sanitizeUserContent } from '@/lib/sanitize'

// Valid order statuses for review eligibility
const VALID_REVIEW_STATUSES = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const productId = params.id
    const checkEligibility = request.nextUrl.searchParams.get('checkEligibility') === 'true'
    const page = Math.max(parseInt(request.nextUrl.searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '10', 10), 1), 100)
    const sortBy = request.nextUrl.searchParams.get('sortBy') || 'newest'

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // If checking eligibility, require authentication
    if (checkEligibility) {
      const token = request.cookies.get('token')?.value
      if (!token) {
        return NextResponse.json({ canReview: false }, { status: 200 })
      }

      const payload = await verifyToken(token)
      if (!payload || payload.role !== 'CUSTOMER') {
        return NextResponse.json({ canReview: false }, { status: 200 })
      }

      // Check if user already reviewed this product
      const existingReview = await getPrisma().productReview.findUnique({
        where: {
          userId_productId: {
            productId,
            userId: payload.userId,
          },
        },
      })

      if (existingReview) {
        return NextResponse.json({ canReview: false, reason: 'already_reviewed' }, { status: 200 })
      }

      // Check if user has purchased this product in a valid order
      const validOrder = await getPrisma().orderItem.findFirst({
        where: {
          productId,
          order: {
            userId: payload.userId,
            paymentStatus: 'PAID',
            status: {
              in: VALID_REVIEW_STATUSES as any,
            },
          },
        },
      })

      return NextResponse.json({ canReview: !!validOrder }, { status: 200 })
    }

    // Get product with cached ratings
    const product = await getPrisma().product.findUnique({
      where: { id: productId },
      select: {
        averageRating: true,
        reviewCount: true,
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
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
      getPrisma().productReview.findMany({
        where: {
          productId,
          isApproved: true,
          isHidden: false,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
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
      getPrisma().productReview.count({
        where: {
          productId,
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
      reviewer: review.user.profile?.firstName ||
                review.user.email.split('@')[0] + '***',
    }))

    const totalPages = Math.ceil(totalReviews / limit)

    return NextResponse.json({
      reviews: maskedReviews,
      averageRating: product.averageRating,
      totalReviews: product.reviewCount,
      starDistribution,
      pagination: {
        page,
        limit,
        total: totalReviews,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
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

    const productId = params.id
    const { rating, comment } = await request.json()
    const sanitizedComment = comment ? sanitizeUserContent(comment, { maxLength: 2000 }) : null

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

    // Verify product exists
    const product = await getPrisma().product.findUnique({
      where: { id: productId },
      include: {
        store: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Anti self-review protection: prevent vendor from reviewing their own product
    if (product.store.userId === payload.userId) {
      return NextResponse.json({ error: 'You cannot review your own product' }, { status: 400 })
    }

    // Check if user already reviewed this product
    const existingReview = await getPrisma().productReview.findUnique({
      where: {
        userId_productId: {
          productId,
          userId: payload.userId,
        },
      },
    })

    if (existingReview) {
      return NextResponse.json({ error: 'You have already reviewed this product' }, { status: 400 })
    }

    // Verify user has purchased this product in a valid order
    const validOrder = await getPrisma().orderItem.findFirst({
      where: {
        productId,
        order: {
          userId: payload.userId,
          paymentStatus: 'PAID',
          status: {
            in: VALID_REVIEW_STATUSES as any,
          },
        },
      },
    })

    if (!validOrder) {
      return NextResponse.json({ 
        error: 'You can only review products from orders that are PROCESSING, SHIPPED, DELIVERED, or COMPLETED' 
      }, { status: 400 })
    }

    // Create review
    const review = await getPrisma().productReview.create({
      data: {
        productId,
        userId: payload.userId,
        rating,
        comment: sanitizedComment,
      },
    })

    // Sync cached rating
    await syncProductRating(productId)

    return NextResponse.json({ review }, { status: 201 })
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}