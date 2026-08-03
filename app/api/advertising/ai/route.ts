import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { recommendCampaignForVendor, predictCampaignSuccess, suggestCampaignDuration, suggestBestHomepageSection } from '@/lib/advertising/ai-integration'
import { logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const recommendations = await recommendCampaignForVendor(payload.userId)

    return NextResponse.json({ recommendations })
  } catch (error) {
    logError(`Error fetching campaign recommendations: ${error}`)
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
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { campaignType, productId, serviceId } = body

    if (!campaignType) {
      return NextResponse.json({ error: 'Missing campaignType' }, { status: 400 })
    }

    const [prediction, duration, section] = await Promise.all([
      predictCampaignSuccess(campaignType, productId, serviceId),
      suggestCampaignDuration(campaignType, body.price || 100),
      suggestBestHomepageSection(campaignType),
    ])

    return NextResponse.json({
      prediction,
      duration,
      suggestedSection: section,
    })
  } catch (error) {
    logError(`Error predicting campaign success: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}