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

    const body = await request.json()
    const { reason, comment } = body

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 })
    }

    const existing = await getPrisma().vendorPostReport.findFirst({
      where: { postId: post.id, userId: outcome.userId },
    })

    if (existing) {
      return NextResponse.json({ error: 'You have already reported this post' }, { status: 400 })
    }

    await getPrisma().vendorPostReport.create({
      data: {
        postId: post.id,
        userId: outcome.userId,
        reason: reason.trim(),
        comment: comment?.trim() || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reporting post:', error)
    return NextResponse.json({ error: 'Failed to report post' }, { status: 500 })
  }
}
