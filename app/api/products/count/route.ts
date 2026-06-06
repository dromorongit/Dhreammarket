import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const whereClause: any = {
      OR: [
        { stock: { gt: 0 } },
        { availabilityType: 'PREORDER' },
        { availabilityType: 'BACKORDER' },
      ],
    }

    const count = await getPrisma().product.count({ where: whereClause })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error fetching product count:', error)
    return NextResponse.json({ error: 'Failed to fetch count' }, { status: 500 })
  }
}