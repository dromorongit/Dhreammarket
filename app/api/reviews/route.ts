import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { syncProductRating } from '@/lib/rating-sync'
import { sanitizeUserContent } from '@/lib/sanitize'

// Valid order statuses for review eligibility
const VALID_REVIEW_STATUSES = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']

// Legacy endpoint - redirects to new product reviews API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const checkEligibility = searchParams.get('checkEligibility') === 'true'

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

    // Get reviews with pagination, only approved and not hidden
    const reviews = await getPrisma().productReview.findMany({
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
      orderBy: { createdAt: 'desc' },
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

    return NextResponse.json({
      reviews: maskedReviews,
      averageRating: product.averageRating,
      totalReviews: product.reviewCount,
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage 
    }, { status: 500 })
  }
}

// Legacy endpoint - redirects to new product reviews API
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Only customers can submit reviews' }, { status: 403 })
    }

    const { productId, rating, comment } = await request.json()

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
    const sanitizedComment = sanitizeUserContent(comment, { maxLength: 2000 })
    const review = await getPrisma().productReview.create({
      data: {
        productId,
        userId: payload.userId,
        rating,
        comment: sanitizedComment || null,
      },
    })

    // Sync cached rating
    await syncProductRating(productId)

    return NextResponse.json({ review }, { status: 201 })
  } catch (error) {
    console.error('Error creating review:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage 
    }, { status: 500 })
  }
}