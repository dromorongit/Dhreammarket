import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

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
