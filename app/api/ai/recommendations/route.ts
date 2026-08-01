import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { getAIEngine } from '@/lib/ai/rule-based-engine'
import type { RecommendationReason } from '@/lib/ai/types'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    const payload = token ? await verifyToken(token) : null

    const type = request.nextUrl.searchParams.get('type') || 'RECOMMENDED_FOR_YOU'
    const entityId = request.nextUrl.searchParams.get('entityId')
    const entityType = request.nextUrl.searchParams.get('entityType') as any
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10')
    const userId = payload?.userId

    const engine = getAIEngine()

    const reasonsMap: Record<string, string[]> = {
      RECOMMENDED_FOR_YOU: ['RECOMMENDED_FOR_YOU'],
      SIMILAR_ITEMS: ['SIMILAR_ITEMS'],
      FREQUENTLY_BOUGHT: ['FREQUENTLY_BOUGHT'],
      PERSONALIZED: ['VIEWED', 'PURCHASED', 'BOOKED', 'WISHLIST', 'VENDOR_FOLLOWING'],
      TRENDING: ['TRENDING'],
    }

    const reasons = (reasonsMap[type] ?? ['RECOMMENDED_FOR_YOU']) as RecommendationReason[]

    const input = {
      userId: type === 'RECOMMENDED_FOR_YOU' || type === 'PERSONALIZED' || type === 'TRENDING' ? userId : undefined,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      limit,
      reasons,
      excludeIds: [],
    }

    const recommendations = await engine.getRecommendations(input)

    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error('Error fetching AI recommendations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}