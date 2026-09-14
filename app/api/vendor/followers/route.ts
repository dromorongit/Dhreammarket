import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
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

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
      select: { id: true },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const follows = await getPrisma().vendorFollow.findMany({
      where: { vendorId: store.id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    })

    const followers = follows.map((f) => ({
      id: f.id,
      userId: f.userId,
      createdAt: f.createdAt,
      user: f.user,
      displayName:
        [f.user.profile?.firstName, f.user.profile?.lastName].filter(Boolean).join(' ') ||
        f.user.email ||
        'Customer',
      avatar: f.user.profile?.avatar || null,
    }))

    return NextResponse.json({ followers })
  } catch (error) {
    console.error('Error fetching vendor followers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
