import { NextRequest, NextResponse } from 'next/server'
import { getAIEngine } from '@/lib/ai/rule-based-engine'

export const dynamic = 'force-dynamic'

// GET /api/trending-products - Get automatic trending products (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'automatic'
    const maxProducts = parseInt(searchParams.get('limit') || '20', 10)
    const timeWindow = (searchParams.get('timeWindow') as any) || '7D'

    if (mode === 'automatic') {
      const engine = getAIEngine()

      const trendingProducts = await engine.getTrending({
        timeWindow,
        entityType: 'PRODUCT',
        limit: maxProducts,
      })

      return NextResponse.json({ products: trendingProducts, mode: 'AUTOMATIC' })
    }

    return NextResponse.json({ products: [], mode: 'MANUAL' })
  } catch (error) {
    console.error('Error fetching trending products:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}