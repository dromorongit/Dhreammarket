import { NextRequest, NextResponse } from 'next/server'
import { getActiveSponsoredPlacements } from '@/lib/advertising/service'

export async function GET(request: NextRequest) {
  try {
    const placements = await getActiveSponsoredPlacements('Sponsored')
    const productIds = placements
      .filter((p) => p.type === 'PRODUCT')
      .map((p) => p.entityId)
    const serviceIds = placements
      .filter((p) => p.type === 'SERVICE')
      .map((p) => p.entityId)

    return NextResponse.json({ productIds, serviceIds })
  } catch (error) {
    console.error('[Sponsored] Failed to fetch sponsored placements:', error)
    return NextResponse.json({ productIds: [], serviceIds: [] }, { status: 200 })
  }
}
