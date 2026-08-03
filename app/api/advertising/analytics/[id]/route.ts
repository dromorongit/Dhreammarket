import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { getCampaignAnalytics, recordAnalytics, expireOldCampaigns } from '@/lib/advertising/service'
import { logInfo, logError } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const campaign = await getPrisma().advertisementCampaign.findUnique({
      where: { id },
      select: { vendorId: true },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (payload.role !== 'SUPER_ADMIN' && campaign.vendorId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const analytics = await getCampaignAnalytics(id)
    return NextResponse.json({ analytics })
  } catch (error) {
    logError(`Error fetching campaign analytics: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    await recordAnalytics(id, body)
    return NextResponse.json({ success: true })
  } catch (error) {
    logError(`Error recording analytics: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.cookies.get('token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const prisma = getPrisma()
    await prisma.advertisementCampaign.delete({ where: { id } })

    logInfo(`Campaign ${id} deleted by admin ${payload.userId}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    logError(`Error deleting campaign: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}