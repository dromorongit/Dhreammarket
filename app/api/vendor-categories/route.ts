import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const categories = await getPrisma().vendorCategory.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        slug: true,
      }
    })

    const response = NextResponse.json({ categories })
    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    return response
  } catch (error) {
    console.error('Error fetching vendor categories:', error)
    return NextResponse.json({ error: 'Failed to fetch vendor categories' }, { status: 500 })
  }
}
