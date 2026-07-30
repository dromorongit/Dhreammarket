import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const serviceId = params.id
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10')
    const sortBy = request.nextUrl.searchParams.get('sortBy') || 'newest'

    if (!serviceId) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 })
    }

    let orderBy: any = { createdAt: 'desc' }
    if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' }
    } else if (sortBy === 'highest_rating') {
      orderBy = { rating: 'desc' }
    } else if (sortBy === 'lowest_rating') {
      orderBy = { rating: 'asc' }
    }

    const skip = (page - 1) * limit
    const [reviews, totalReviews] = await Promise.all([
      getPrisma().serviceReview.findMany({
        where: { serviceId, isApproved: true, isHidden: false },
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          userId: true, requestId: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      getPrisma().serviceReview.count({
        where: { serviceId, isApproved: true, isHidden: false },
      }),
    ])

    const userIds = Array.from(new Set(reviews.map((r) => r.userId)))
    const users = await getPrisma().user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    const maskedReviews = reviews.map((review) => {
      const user = userMap.get(review.userId)
      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        isVerifiedPurchase: review.requestId !== null,
        reviewer: user?.profile?.firstName || user?.email.split('@')[0] + '***',
      }
    })

    const starDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    reviews.forEach((review) => {
      starDistribution[review.rating as keyof typeof starDistribution]++
    })

    const totalPages = Math.ceil(totalReviews / limit)

    return NextResponse.json({
      reviews: maskedReviews,
      averageRating: totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0,
      totalReviews,
      starDistribution,
      pagination: { page, limit, total: totalReviews, totalPages },
    })
  } catch (error) {
    console.error('Error fetching service reviews:', error)
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

    const serviceId = params.id
    const { rating, comment, requestId } = await request.json()

    if (rating === undefined || rating === null) {
      return NextResponse.json({ error: 'Rating is required' }, { status: 400 })
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 })
    }

    const service = await getPrisma().service.findUnique({ where: { id: serviceId } })
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    const store = await getPrisma().store.findUnique({
      where: { id: service.vendorId },
      select: { userId: true },
    })

    if (store?.userId === payload.userId) {
      return NextResponse.json({ error: 'You cannot review your own service' }, { status: 400 })
    }

    const existing = await getPrisma().serviceReview.findUnique({
      where: { userId_serviceId: { userId: payload.userId, serviceId } },
    })
    if (existing) {
      return NextResponse.json({ error: 'You have already reviewed this service' }, { status: 400 })
    }

    if (requestId) {
      const request = await getPrisma().serviceRequest.findUnique({
        where: { id: requestId },
        select: { customerId: true, status: true },
      })
      if (!request || request.customerId !== payload.userId) {
        return NextResponse.json({ error: 'Invalid service request' }, { status: 400 })
      }
      if (request.status !== 'COMPLETED') {
        return NextResponse.json({ error: 'Can only review completed service requests' }, { status: 400 })
      }
    }

    const review = await getPrisma().serviceReview.create({
      data: {
        serviceId,
        userId: payload.userId,
        rating,
        comment: comment?.trim() || null,
        requestId: requestId || null,
      },
    })

    return NextResponse.json({ review }, { status: 201 })
  } catch (error) {
    console.error('Error creating service review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}