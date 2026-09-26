import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated || outcome.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isOnboarded = await isVendorOnboarded(outcome.userId)
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup to manage posts' }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: outcome.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const body = await request.json()
    const { content, imageUrl } = body

    const post = await getPrisma().vendorPost.create({
      data: {
        vendorId: outcome.userId,
        storeId: store.id,
        content: typeof content === 'string' ? content.trim() : '',
        imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
      },
      include: {
        _count: { select: { likes: true, comments: true } },
      },
    })

    return NextResponse.json({
      post: {
        id: post.id,
        content: post.content,
        imageUrl: post.imageUrl,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated || outcome.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isOnboarded = await isVendorOnboarded(outcome.userId)
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup to view feed' }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: outcome.userId },
    })

    if (!store) {
      return NextResponse.json({ posts: [] })
    }

    const posts = await getPrisma().vendorPost.findMany({
      where: { storeId: store.id },
      include: { _count: { select: { likes: true, comments: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      posts: posts.map((post) => ({
        id: post.id,
        content: post.content,
        imageUrl: post.imageUrl,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
      })),
    })
  } catch (error) {
    console.error('Error fetching vendor feed posts:', error)
    return NextResponse.json({ posts: [] }, { status: 500 })
  }
}
