import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

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

    const sessions = [
      {
        id: 'current',
        device: 'Current Session',
        location: 'Accra, Ghana',
        lastActive: new Date().toISOString(),
        current: true,
        userAgent: request.headers.get('user-agent') || 'Unknown',
      },
    ]

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
