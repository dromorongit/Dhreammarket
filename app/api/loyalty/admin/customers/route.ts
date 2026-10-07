import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const customers = await getPrisma().customerLoyalty.findMany({
      orderBy: { totalPointsEarned: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, email: true, profile: true } },
        tier: true,
      },
    })

    return NextResponse.json({ customers })
  } catch (error) {
    console.error('Error fetching loyalty customers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}