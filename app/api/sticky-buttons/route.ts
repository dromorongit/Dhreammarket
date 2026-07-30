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

    const { pageUrl, buttonType, action } = await request.json()

    if (!pageUrl || !buttonType) {
      return NextResponse.json({ error: 'Page URL and button type are required' }, { status: 400 })
    }

    if (action === 'impression') {
      const existing = await getPrisma().stickyButton.findFirst({
        where: { pageUrl, buttonType },
      })
      if (existing) {
        await getPrisma().stickyButton.update({
          where: { id: existing.id },
          data: { impressionCount: { increment: 1 } },
        })
      } else {
        await getPrisma().stickyButton.create({
          data: { pageUrl, buttonType, impressionCount: 1, clickCount: 0 },
        })
      }
    } else if (action === 'click') {
      const existing = await getPrisma().stickyButton.findFirst({
        where: { pageUrl, buttonType },
      })
      if (existing) {
        await getPrisma().stickyButton.update({
          where: { id: existing.id },
          data: { clickCount: { increment: 1 } },
        })
      } else {
        await getPrisma().stickyButton.create({
          data: { pageUrl, buttonType, impressionCount: 0, clickCount: 1 },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording sticky button:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const pageUrl = request.nextUrl.searchParams.get('pageUrl')

    if (!pageUrl) {
      return NextResponse.json({ buttons: [] })
    }

    const buttons = await getPrisma().stickyButton.findMany({
      where: { pageUrl },
    })

    return NextResponse.json({ buttons })
  } catch (error) {
    console.error('Error fetching sticky buttons:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}