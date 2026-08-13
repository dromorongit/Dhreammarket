// Webhook endpoint for Paystack verification payment callbacks
import { NextRequest, NextResponse } from 'next/server'
import { handleVerificationWebhook } from '@/lib/webhooks/verification-webhook-handler'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-paystack-signature')
  const body = await request.text()
  return handleVerificationWebhook(body, signature ?? undefined)
}