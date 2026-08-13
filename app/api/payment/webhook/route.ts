import { NextRequest, NextResponse } from 'next/server'
import { handleOrderWebhook } from '@/lib/webhooks/order-webhook-handler'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-paystack-signature')
  const body = await request.text()
  return handleOrderWebhook(body, signature ?? undefined)
}