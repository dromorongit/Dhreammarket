import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

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

    const existing = await getPrisma().vendorPostLike.findUnique({
      where: { postId_userId: { postId: post.id, userId: outcome.userId } },
    })

    if (existing) {
      await getPrisma().vendorPostLike.delete({
        where: { id: existing.id },
      })
      return NextResponse.json({ liked: false })
    }

    await getPrisma().vendorPostLike.create({
      data: { postId: post.id, userId: outcome.userId },
    })

    return NextResponse.json({ liked: true })
  } catch (error) {
    console.error('Error toggling like:', error)
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 })
  }
}
