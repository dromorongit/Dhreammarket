import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { handleOrderWebhook } from '@/lib/webhooks/order-webhook-handler'
import { handleVerificationWebhook } from '@/lib/webhooks/verification-webhook-handler'
import { handleSubscriptionWebhook } from '@/lib/webhooks/subscription-webhook-handler'
import { handleAdvertisingWebhook } from '@/lib/webhooks/advertising-webhook-handler'
import { handleRefundWebhook, isRefundEvent } from '@/lib/webhooks/refund-webhook-handler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Verify the Paystack signature over the RAW body.
 *
 * The secret is read at call time, never cached in a module-scope const, so
 * this route always verifies against the environment as it is right now.
 *
 * Only refund.* events are verified here. DHV-/VER-/SUB-/ADV- events are NOT
 * verified by this route at all: each of those handlers performs its own
 * signature verification over the same raw body with its own captured secret,
 * and pre-verifying them here would let a handler that legitimately uses a
 * different secret be rejected with a 401 before it ever ran.
 */
function verifyWebhookSignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return false

  const expectedSignature = crypto.createHmac('sha512', secret).update(body).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))
  } catch {
    return false
  }
}

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

    // Refund lifecycle events carry the transaction in
    // data.transaction_reference or data.transaction.reference rather than
    // data.reference, so they are routed ahead of the prefix logic and are the
    // only events whose signature this route checks itself.
    if (isRefundEvent(parsedBody?.event)) {
      if (!verifyWebhookSignature(body, signature ?? undefined)) {
        console.error('[Paystack Webhook] Invalid signature on refund event - rejecting webhook')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      return await handleRefundWebhook(body, signature ?? undefined)
    }

    const reference = parsedBody?.data?.reference

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

    // The raw body, the x-paystack-signature header value and the verification
    // step are handed to the handler untouched, exactly as before.
    return await handler(body, signature ?? undefined)
  } catch (error) {
    console.error('Error in unified webhook dispatcher:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
