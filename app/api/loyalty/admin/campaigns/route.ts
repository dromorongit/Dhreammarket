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
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const campaigns = await getPrisma().vendorRewardCampaign.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { vendor: { select: { id: true, email: true, profile: true } } },
    })

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('Error fetching vendor campaigns:', error)
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
    const { vendorId, name, description, type, rewardType, value, minPurchase, maxReward, startDate, endDate, appliesToProducts, appliesToServices } = body

    if (!vendorId || !name) {
      return NextResponse.json({ error: 'vendorId and name are required' }, { status: 400 })
    }

    const campaign = await getPrisma().vendorRewardCampaign.create({
      data: {
        vendorId,
        name,
        description,
        type,
        rewardType,
        value,
        minPurchase,
        maxReward,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        appliesToProducts: appliesToProducts ?? null,
        appliesToServices: appliesToServices ?? null,
      },
    })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    console.error('Error creating vendor campaign:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}