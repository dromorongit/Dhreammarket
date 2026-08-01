import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { getAIEngine } from '@/lib/ai/rule-based-engine'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = getPrisma()
    const store = await prisma.store.findUnique({
      where: { userId: payload.userId },
      select: { id: true },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10')
    const engine = getAIEngine()

    const insights = await engine.getVendorInsights({
      vendorId: store.id,
      userId: payload.userId,
    })

    return NextResponse.json({ insights })
  } catch (error) {
    console.error('Error fetching vendor insights:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}