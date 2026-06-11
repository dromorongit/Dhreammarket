import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { getVendorDemandAnalytics } from '@/lib/demand-forecast'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const analytics = await getVendorDemandAnalytics(payload.userId)

    return NextResponse.json({
      success: true,
      analytics,
    })
  } catch (error) {
    console.error('Error fetching vendor demand analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch demand analytics' }, { status: 500 })
  }
}