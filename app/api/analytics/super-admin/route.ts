import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { getSuperAdminAnalytics, exportAnalyticsData } from '@/lib/analytics-engine'

export const dynamic = 'force-dynamic'

function parseFilter(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const range = (searchParams.get('range') || 'thismonth') as any
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined
  return { range, from, to }
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const filter = parseFilter(request)
    const exportType = request.nextUrl.searchParams.get('export')

    if (exportType) {
      const data = await exportAnalyticsData(exportType, filter)
      return NextResponse.json({ success: true, data })
    }

    const analytics = await getSuperAdminAnalytics(filter)
    return NextResponse.json({ success: true, analytics })
  } catch (error) {
    console.error('[SUPER ADMIN ANALYTICS API ERROR]', error)
    return NextResponse.json(
      { success: false, message: 'Internal Server Error', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}