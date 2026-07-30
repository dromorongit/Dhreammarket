import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { pageUrl, referrer } = await request.json()

    await getPrisma().exitIntent.create({
      data: {
        userId: payload.userId,
        pageUrl,
        referrer,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording exit intent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const exitIntents = await getPrisma().exitIntent.findMany({
      where: { userId: payload.userId },
      orderBy: { triggeredAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ exitIntents })
  } catch (error) {
    console.error('Error fetching exit intents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}