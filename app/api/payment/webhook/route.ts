import { NextRequest, NextResponse } from 'next/server'
import { POST as unifiedPaystackWebhook } from '@/app/api/webhook/paystack/route'

// Legacy path kept for the Paystack dashboard configuration. It delegates to
// the unified dispatcher so payment AND refund events behave identically here
// to /api/webhook/paystack: same raw body, same signature header, same
// handlers. This file owns no webhook logic of its own.
//
// The two segment configs below must stay literal, static exports in this
// file. Next.js reads them statically at build time, so re-exporting them
// from the unified route would silently drop them from this path.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  return unifiedPaystackWebhook(request, {
    routeLabel: '/api/payment/webhook (delegated)',
  })
}
