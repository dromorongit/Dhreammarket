import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let store = await getPrisma().store.findUnique({
      where: { slug: params.id },
      select: { id: true },
    })

    if (!store) {
      store = await getPrisma().store.findUnique({
        where: { id: params.id },
        select: { id: true },
      })
    }

    if (!store) {
      return NextResponse.json({ posts: [] })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    const [posts, total] = await Promise.all([
      getPrisma().vendorPost.findMany({
        where: { storeId: store.id, isHidden: false },
        include: {
          vendor: {
            select: { id: true, profile: { select: { firstName: true, lastName: true, avatar: true } } },
          },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      getPrisma().vendorPost.count({
        where: { storeId: store.id, isHidden: false },
      }),
    ])

    const formatted = posts.map((post) => ({
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: {
        id: post.vendor.id,
        name: [post.vendor.profile?.firstName, post.vendor.profile?.lastName].filter(Boolean).join(' ') || 'Vendor',
        avatar: post.vendor.profile?.avatar || null,
      },
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
    }))

    return NextResponse.json({
      posts: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching vendor feed:', error)
    return NextResponse.json({ posts: [] }, { status: 500 })
  }
}
