import { NextRequest, NextResponse } from 'next/server'
import { getPlatformPreferences } from '@/lib/platform-preferences'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const preferences = await getPlatformPreferences()
    return NextResponse.json({
      defaultCurrency: preferences.defaultCurrency,
      branding: preferences.brandingPreferences,
      platformName: preferences.platformName,
      platformTimezone: preferences.platformTimezone,
    })
  } catch (error) {
    console.error('Platform config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}