import { NextRequest, NextResponse } from 'next/server'
import { getAuditLogs } from '@/lib/audit-log'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1', 10)
    const requestedLimit = parseInt(searchParams.get('limit') || '50', 10)
    const limit = Math.min(requestedLimit, 100)
    const action = searchParams.get('action') || undefined
    const entityType = searchParams.get('entityType') || undefined
    const userId = searchParams.get('userId') || undefined
    const search = searchParams.get('search') || undefined

    let dateFrom: Date | undefined
    let dateTo: Date | undefined

    const dateFromStr = searchParams.get('dateFrom')
    const dateToStr = searchParams.get('dateTo')

    if (dateFromStr) {
      dateFrom = new Date(dateFromStr)
    }
    if (dateToStr) {
      dateTo = new Date(dateToStr)
    }

    const result = await getAuditLogs({
      page,
      limit,
      action,
      entityType,
      userId,
      dateFrom,
      dateTo,
      search,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}