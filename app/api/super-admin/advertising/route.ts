import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import {
  getCampaignsByVendor,
  getCampaignById,
  updateCampaignStatus,
  getCampaignAnalytics,
  expireOldCampaigns,
} from '@/lib/advertising/service'
import { logInfo, logError } from '@/lib/logger'

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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as any
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const prisma = getPrisma()
    const where: any = {}
    if (status) where.campaignStatus = status

    const [campaigns, totalCount, revenueStats, expiredCount] = await Promise.all([
      prisma.advertisementCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          vendor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
          product: { select: { id: true, name: true, slug: true, price: true } },
          service: { select: { id: true, title: true, slug: true, startingPrice: true } },
          placements: { orderBy: { displayOrder: 'asc' } },
          payments: { orderBy: { createdAt: 'desc' } },
          invoice: true,
          analytics: { orderBy: { date: 'desc' }, take: 7 },
        },
      }),
      prisma.advertisementCampaign.count({ where }),
      prisma.advertisementPayment.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
      prisma.advertisementCampaign.count({
        where: { campaignStatus: 'EXPIRED' },
      }),
    ])

    const topCampaigns = await prisma.advertisementCampaign.findMany({
      where: { campaignStatus: 'ACTIVE' },
      orderBy: { revenueGenerated: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        campaignType: true,
        revenueGenerated: true,
        views: true,
        clicks: true,
      },
    })

    return NextResponse.json({
      campaigns,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
      revenue: {
        total: revenueStats._sum.amount ?? 0,
        activeCampaigns: campaigns.filter((c) => c.campaignStatus === 'ACTIVE').length,
        pendingApprovals: campaigns.filter((c) => c.campaignStatus === 'PENDING_APPROVAL').length,
        expiredCampaigns: expiredCount,
      },
      topCampaigns,
    })
  } catch (error) {
    logError(`Error fetching super admin advertising dashboard: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}