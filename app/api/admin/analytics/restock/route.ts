import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { getAdminRestockAnalytics } from '@/lib/restock-procurement'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const analytics = await getAdminRestockAnalytics()

    return NextResponse.json({
      success: true,
      analytics,
    })
  } catch (error) {
    console.error('Error fetching admin restock analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch restock analytics' }, { status: 500 })
  }
}