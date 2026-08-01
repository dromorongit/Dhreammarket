import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { getAIEngine } from '@/lib/ai/rule-based-engine'

export async function GET(request: NextRequest) {
  try {
    const entityId = request.nextUrl.searchParams.get('entityId')
    const entityType = request.nextUrl.searchParams.get('entityType') as any
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10')

    if (!entityId || !entityType) {
      return NextResponse.json({ error: 'entityId and entityType are required' }, { status: 400 })
    }

    const engine = getAIEngine()

    const frequentlyBought = await engine.getFrequentlyBought({
      entityId,
      entityType,
      limit,
    })

    return NextResponse.json({ frequentlyBought })
  } catch (error) {
    console.error('Error fetching AI frequently bought:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}