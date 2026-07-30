import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const vendorId = params.id

    if (payload.userId === vendorId) {
      return NextResponse.json({ error: 'You cannot follow yourself' }, { status: 400 })
    }

    const existing = await getPrisma().vendorFollow.findFirst({
      where: { userId: payload.userId, vendorId },
    })

    if (existing) {
      await getPrisma().vendorFollow.delete({ where: { id: existing.id } })
      return NextResponse.json({ followed: false })
    }

    await getPrisma().vendorFollow.create({
      data: { userId: payload.userId, vendorId },
    })

    const vendor = await getPrisma().user.findUnique({
      where: { id: vendorId },
      select: { profile: { select: { firstName: true } } },
    })

    await getPrisma().notification.create({
      data: {
        userId: vendorId,
        type: 'FOLLOW_VENDOR',
        title: 'New Follower',
        message: `${payload.userId} started following your store`,
      },
    })

    return NextResponse.json({ followed: true })
  } catch (error) {
    console.error('Error toggling vendor follow:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const vendorId = params.id
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20')

    const skip = (page - 1) * limit
    const [follows, total] = await Promise.all([
      getPrisma().vendorFollow.findMany({
        where: { vendorId },
        select: {
          id: true, userId: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      getPrisma().vendorFollow.count({ where: { vendorId } }),
    ])

    const userIds = Array.from(new Set(follows.map((f) => f.userId)))
    const users = await getPrisma().user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, profile: { select: { firstName: true, lastName: true, avatar: true } } },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    const followsWithUsers = follows.map((f) => ({
      ...f,
      follower: userMap.get(f.userId),
    }))

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      followers: followsWithUsers,
      followerCount: total,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error('Error fetching vendor followers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}