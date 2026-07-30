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
    if (!payload || (payload.role !== 'VENDOR' && payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Only vendors can reply to reviews' }, { status: 403 })
    }

    const { reviewId } = params
    const { message } = await request.json()

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const review = await getPrisma().productReview.findUnique({
      where: { id: reviewId },
      include: { product: { select: { storeId: true } } },
    })

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    const product = review.product
    const vendorId = (await getPrisma().store.findUnique({
      where: { id: product.storeId },
      select: { userId: true },
    }))?.userId

    if (vendorId !== payload.userId && payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'You can only reply to reviews of your own products' }, { status: 403 })
    }

    const reply = await getPrisma().vendorReply.create({
      data: {
        reviewId,
        vendorId: payload.userId,
        message: message.trim(),
      },
    })

    return NextResponse.json({ reply }, { status: 201 })
  } catch (error) {
    console.error('Error creating vendor reply:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string; reviewId: string } }) {
  try {
    const { reviewId } = params
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10')

    const skip = (page - 1) * limit
    const [replies, total] = await Promise.all([
      getPrisma().vendorReply.findMany({
        where: { reviewId },
        select: { id: true, vendorId: true, message: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      getPrisma().vendorReply.count({ where: { reviewId } }),
    ])

    const vendorIdArray = Array.from(new Set(replies.map((r) => r.vendorId)))
    const vendors = await getPrisma().user.findMany({
      where: { id: { in: vendorIdArray } },
      select: { id: true, profile: { select: { firstName: true, lastName: true } } },
    })
    const vendorMap = new Map(vendors.map((v) => [v.id, v]))

    const maskedReplies = replies.map((reply) => ({
      ...reply,
      vendor: vendorMap.get(reply.vendorId),
    }))

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      replies: maskedReplies,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error('Error fetching vendor replies:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}