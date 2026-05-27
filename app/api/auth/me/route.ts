import { NextRequest, NextResponse } from 'next/server'
import { getUserFromToken } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userFromToken = getUserFromToken()
    if (!userFromToken) {
      return NextResponse.json({ user: null }, { status: 200 })
    }
    const user = await getPrisma().user.findUnique({
      where: { id: userFromToken.userId },
      include: { profile: true, store: true },
    })
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 })
    }
    return NextResponse.json({ user }, { status: 200 })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}