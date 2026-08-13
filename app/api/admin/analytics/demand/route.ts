import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { getAdminDemandAnalytics } from '@/lib/demand-forecast'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const analytics = await getAdminDemandAnalytics()

    return NextResponse.json({
      success: true,
      analytics,
    })
  } catch (error) {
    console.error('Error fetching admin demand analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch demand analytics' }, { status: 500 })
  }
}