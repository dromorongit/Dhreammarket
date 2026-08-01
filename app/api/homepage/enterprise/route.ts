import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { getTopSellingProducts } from '@/lib/top-selling'

export const revalidate = 120

// GET /api/homepage/enterprise - Automatic homepage data (Top Selling only)
export async function GET(_request: NextRequest) {
  try {
    const prisma = getPrisma()
    const topSelling = await getTopSellingProducts(prisma, 20)

    const response = NextResponse.json({ topSelling })
    response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300, max-age=60')
    return response
  } catch (error) {
    console.error('Error fetching enterprise homepage data:', error)
    return NextResponse.json({ topSelling: [] }, { status: 200 })
  }
}
