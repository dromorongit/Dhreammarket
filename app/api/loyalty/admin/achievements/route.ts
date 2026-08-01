import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { LoyaltyEngine } from '@/lib/loyalty/loyalty-engine'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const achievements = await getPrisma().achievement.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    })

    return NextResponse.json({ achievements })
  } catch (error) {
    console.error('Error fetching achievements:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, slug, description, badge, color, icon, criteria, points, cashbackReward, displayOrder } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    const achievement = await getPrisma().achievement.create({
      data: {
        name,
        slug,
        description,
        badge,
        color,
        icon,
        criteria: criteria ?? {},
        points: points ?? 0,
        cashbackReward: cashbackReward ?? 0,
        displayOrder: displayOrder ?? 0,
      },
    })

    return NextResponse.json({ achievement }, { status: 201 })
  } catch (error) {
    console.error('Error creating achievement:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}