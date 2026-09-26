import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const post = await getPrisma().vendorPost.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!post) {
      return NextResponse.json({ comments: [] }, { status: 404 })
    }

    const comments = await getPrisma().vendorPostComment.findMany({
      where: { postId: post.id },
      include: {
        user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatar: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      comments: comments.map((comment) => ({
        id: comment.id,
        message: comment.message,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: {
          id: comment.user.id,
          name: [comment.user.profile?.firstName, comment.user.profile?.lastName].filter(Boolean).join(' ') || 'Customer',
          avatar: comment.user.profile?.avatar || null,
        },
      })),
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ comments: [] }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const post = await getPrisma().vendorPost.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const body = await request.json()
    const { message } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Comment is required' }, { status: 400 })
    }

    if (message.trim().length > 1000) {
      return NextResponse.json({ error: 'Comment must be under 1000 characters' }, { status: 400 })
    }

    const comment = await getPrisma().vendorPostComment.create({
      data: { postId: post.id, userId: outcome.userId, message: message.trim() },
      include: {
        user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatar: true } } } },
      },
    })

    return NextResponse.json({
      comment: {
        id: comment.id,
        message: comment.message,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: {
          id: comment.user.id,
          name: [comment.user.profile?.firstName, comment.user.profile?.lastName].filter(Boolean).join(' ') || 'Customer',
          avatar: comment.user.profile?.avatar || null,
        },
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
