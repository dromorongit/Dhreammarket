import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

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

    const preferences = await getPrisma().notificationPreference.findMany({
      where: { userId: payload.userId },
    })

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { category, email, browser, inApp } = await request.json()

    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }

    await getPrisma().notificationPreference.upsert({
      where: {
        userId_category: { userId: payload.userId, category },
      },
      update: { email, browser, inApp },
      create: {
        userId: payload.userId,
        category,
        email: email ?? true,
        browser: browser ?? true,
        inApp: inApp ?? true,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}