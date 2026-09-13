import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { LoyaltyEngine } from '@/lib/loyalty/loyalty-engine'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const payload = outcome

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

    const store = await getPrisma().store.findUnique({
      where: { id: vendorId },
      select: { userId: true },
    })

    if (!store) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    await getPrisma().notification.create({
      data: {
        userId: store.userId,
        type: 'FOLLOW_VENDOR',
        title: 'New Follower',
        message: 'A user started following your store',
      },
    })

    try {
      const totalFollows = await getPrisma().vendorFollow.count({ where: { userId: payload.userId } })
      const loyalty = await getPrisma().customerLoyalty.findUnique({
        where: { userId: payload.userId },
        select: { followVendorRewardClaimed: true },
      })
      if (totalFollows >= 5 && !loyalty?.followVendorRewardClaimed) {
        await LoyaltyEngine.processFollowVendorReward(payload.userId)
        await getPrisma().customerLoyalty.update({
          where: { userId: payload.userId },
          data: { followVendorRewardClaimed: true },
        })
      }
    } catch (loyaltyErr) {
      console.error('Auto follow vendor reward failed:', loyaltyErr)
    }

    return NextResponse.json({ followed: true })
  } catch (error) {
    console.error('Error toggling vendor follow:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const vendorId = params.id
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20') || 20))

    const skip = (page - 1) * limit

    const token = request.cookies.get('token')?.value
    let isFollowing = false
    if (token) {
      const outcome = await verifyToken(token)
      if (outcome.authenticated && outcome.userId !== vendorId) {
        const existing = await getPrisma().vendorFollow.findFirst({
          where: { userId: outcome.userId, vendorId },
        })
        isFollowing = !!existing
      }
    }

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
      isFollowing,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error('Error fetching vendor followers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}