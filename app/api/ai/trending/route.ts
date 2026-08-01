import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { getAIEngine } from '@/lib/ai/rule-based-engine'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    const payload = token ? await verifyToken(token) : null

    const timeWindow = (request.nextUrl.searchParams.get('timeWindow') as any) || '7D'
    const entityType = (request.nextUrl.searchParams.get('entityType') as any) || 'PRODUCT'
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10')
    const userId = payload?.userId

    const engine = getAIEngine()

    const trending = await engine.getTrending({
      timeWindow,
      entityType,
      limit,
      userId,
    })

    return NextResponse.json({ trending })
  } catch (error) {
    console.error('Error fetching AI trending:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}