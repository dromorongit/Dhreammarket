import { NextRequest, NextResponse } from 'next/server'
import { handleOrderWebhook } from '@/lib/webhooks/order-webhook-handler'
import { handleVerificationWebhook } from '@/lib/webhooks/verification-webhook-handler'
import { handleSubscriptionWebhook } from '@/lib/webhooks/subscription-webhook-handler'
import { handleAdvertisingWebhook } from '@/lib/webhooks/advertising-webhook-handler'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-paystack-signature')
    const body = await request.text()

    if (!body) {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }

    let parsedBody: any
    try {
      parsedBody = JSON.parse(body)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const reference = parsedBody.data?.reference

    if (!reference) {
      return NextResponse.json({ error: 'Reference is required in data.reference' }, { status: 400 })
    }

    let handler: ((body: string, signature: string | undefined) => Promise<NextResponse>) | null = null

    if (reference.startsWith('DHV-')) {
      handler = handleOrderWebhook
    } else if (reference.startsWith('VER-')) {
      handler = handleVerificationWebhook
    } else if (reference.startsWith('SUB-')) {
      handler = handleSubscriptionWebhook
    } else if (reference.startsWith('ADV-')) {
      handler = handleAdvertisingWebhook
    } else {
      console.log(`[Paystack Webhook] Unrecognized reference prefix for reference: ${reference}`)
      return NextResponse.json({ received: true, message: 'Event acknowledged but not handled' })
    }

    return await handler(body, signature ?? undefined)
  } catch (error) {
    console.error('Error in unified webhook dispatcher:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
