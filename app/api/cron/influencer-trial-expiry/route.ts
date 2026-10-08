import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { downgradeExpiredInfluencerTrials, notifyExpiringInfluencerTrials } from '@/lib/influencer/vendor-trial'

export const dynamic = 'force-dynamic'

function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('CRON_SECRET is not set')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!safeEqual(token, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === 'true'

  try {
    const downgradeFn = dryRun
      ? () => downgradeExpiredInfluencerTrials(true)
      : downgradeExpiredInfluencerTrials

    const [downgradeResult, notifyResult] = await Promise.all([
      downgradeFn(),
      notifyExpiringInfluencerTrials(5),
    ])

    return NextResponse.json({
      ok: true,
      dryRun,
      downgraded: downgradeResult.processed,
      notified: notifyResult.notified,
    })
  } catch (error) {
    console.error('Influencer trial cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Recommended schedule: daily at 02:00 UTC
// Example cron (crontab): 0 2 * * * curl -X POST https://yourdomain.com/api/cron/influencer-trial-expiry -H "Authorization: Bearer $CRON_SECRET"
// Example Vercel Cron (vercel.json):
// {
//   "crons": [
//     { "path": "/api/cron/influencer-trial-expiry", "schedule": "0 2 * * *" }
//   ]
// }
