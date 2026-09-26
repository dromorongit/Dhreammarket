import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

async function getPostOrNull(postId: string) {
  return getPrisma().vendorPost.findUnique({
    where: { id: postId },
    include: { vendor: { select: { id: true } }, store: { select: { id: true } } },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const post = await getPostOrNull(params.id)
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const likes = await getPrisma().vendorPostLike.findMany({
      where: { postId: post.id },
      include: { user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatar: true } } } } },
    })

    const comments = await getPrisma().vendorPostComment.findMany({
      where: { postId: post.id },
      include: { user: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatar: true } } } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      post: {
        id: post.id,
        content: post.content,
        imageUrl: post.imageUrl,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: {
          id: post.vendor.id,
          name: 'Vendor',
        },
        likes: likes.map((like) => ({
          id: like.id,
          createdAt: like.createdAt,
          user: {
            id: like.user.id,
            name: [like.user.profile?.firstName, like.user.profile?.lastName].filter(Boolean).join(' ') || 'Customer',
            avatar: like.user.profile?.avatar || null,
          },
        })),
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
      },
    })
  } catch (error) {
    console.error('Error fetching post:', error)
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const post = await getPostOrNull(params.id)
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.storeId !== store.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { content, imageUrl, isHidden } = body

    const updated = await getPrisma().vendorPost.update({
      where: { id: params.id },
      data: {
        content: content !== undefined ? content.trim() : post.content,
        imageUrl: imageUrl !== undefined ? imageUrl : post.imageUrl,
        isHidden: isHidden !== undefined ? isHidden : post.isHidden,
      },
      include: {
        vendor: { select: { id: true, profile: { select: { firstName: true, lastName: true, avatar: true } } } },
        _count: { select: { likes: true, comments: true } },
      },
    })

    return NextResponse.json({
      post: {
        id: updated.id,
        content: updated.content,
        imageUrl: updated.imageUrl,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        author: {
          id: updated.vendor.id,
          name: [updated.vendor.profile?.firstName, updated.vendor.profile?.lastName].filter(Boolean).join(' ') || 'Vendor',
          avatar: updated.vendor.profile?.avatar || null,
        },
        likesCount: updated._count.likes,
        commentsCount: updated._count.comments,
      },
    })
  } catch (error) {
    console.error('Error updating post:', error)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const post = await getPostOrNull(params.id)
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.storeId !== store.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await getPrisma().vendorPost.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting post:', error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}
