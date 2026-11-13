import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { runReturnReviewOverdue } from '@/lib/returns/return-review-overdue'
import { isBusinessDayReturnReviewEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
    console.error('[Return Review Overdue] CRON_SECRET is not set')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!safeEqual(token, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isBusinessDayReturnReviewEnabled()) {
    return NextResponse.json({ ok: true, skipped: 'flag_off' })
  }

  try {
    const result = await runReturnReviewOverdue()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Return Review Overdue] Cron job failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
