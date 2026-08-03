import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { checkAndNotifyExpiringCampaigns } from '@/lib/advertising/notification-integration'
import { logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const expiringCount = await checkAndNotifyExpiringCampaigns()

    return NextResponse.json({
      success: true,
      expiringCampaigns: expiringCount,
      message: `Checked and notified ${expiringCount} expiring campaigns`,
    })
  } catch (error) {
    logError(`Error checking expiring campaigns: ${error}`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}