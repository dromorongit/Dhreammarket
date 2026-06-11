import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { getVendorProcurementDashboard } from '@/lib/supplier-procurement'

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

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({
        openPurchaseOrders: 0,
        ordersInTransit: 0,
        overduePurchaseOrders: 0,
        bestSupplier: null,
        totalProcurementSpend: 0,
      })
    }

    const dashboard = await getVendorProcurementDashboard(payload.userId)

    return NextResponse.json({
      success: true,
      ...dashboard,
    })
  } catch (error) {
    console.error('Error fetching procurement analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch procurement analytics' },
      { status: 500 }
    )
  }
}