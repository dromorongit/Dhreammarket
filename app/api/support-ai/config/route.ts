import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SupportAiMode = 'v1' | 'v2'

function isPilotUser(userId: string): boolean {
  const pilotAll = process.env.SUPPORT_AI_V2_PILOT_ALL
  if (pilotAll?.trim().toLowerCase() === 'true') return true

  const pilotIds = process.env.SUPPORT_AI_V2_PILOT_USER_IDS
  if (pilotIds) {
    return pilotIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(userId)
  }
  return false
}

async function killSwitchAllows(): Promise<boolean> {
  const envOverride = process.env.SUPPORT_AI_V2_ENABLED
  if (envOverride !== undefined && envOverride !== '') {
    return envOverride.trim().toLowerCase() === 'true'
  }
  try {
    const settings = await getPrisma().superAdminSettings.findFirst()
    return settings?.supportAiV2Enabled === true
  } catch {
    return false
  }
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  let mode: SupportAiMode = 'v1'
  try {
    if (await killSwitchAllows()) {
      let session
      try {
        session = await getServerSession()
      } catch {
        session = null
      }
      if (session?.userId && isPilotUser(session.userId)) {
        mode = 'v2'
      }
    }
  } catch {
    mode = 'v1'
  }
  return NextResponse.json({ mode }, { headers: { 'Cache-Control': 'no-store' } })
}
