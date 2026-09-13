import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { getAIEngine } from '@/lib/ai/rule-based-engine'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = outcome

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10')
    const engine = getAIEngine()

    const insights = await engine.getCustomerInsights({
      userId: payload.userId,
      limit,
    })

    return NextResponse.json({ insights })
  } catch (error) {
    console.error('Error fetching customer insights:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}