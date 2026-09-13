import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

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