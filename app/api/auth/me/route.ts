import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { cookies } from 'next/headers'
import { getPrisma } from '@/lib/prisma'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const token = cookies().get('token')?.value
    const outcome = token ? await verifyToken(token) : null
    if (!outcome || !outcome.authenticated) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ user: null }, { status: 200 })
    }
    const payload = outcome
    const user = await getPrisma().user.findUnique({
      where: { id: payload.userId },
      include: { profile: true, store: true },
    })
    perf.markPrismaEnd(prismaPerfStart)

    if (!user) {
      perf.log()
      return NextResponse.json({ user: null }, { status: 200 })
    }
    perf.log()
    return NextResponse.json({ user }, { status: 200 })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}