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

/**
 * The route path this request was received on, used only as a log label.
 *
 * The legacy /api/payment/webhook path delegates to POST below, and without
 * this label an operator reading the logs could not tell which configured URL
 * the event arrived on.
 */
const ROUTE_LABEL = '/api/webhook/paystack'

/**
 * The only route labels this file will log.
 *
 * The second is passed by the delegating legacy route so an operator can tell
 * which configured URL an event arrived on. Any other value - including
 * anything derived from the request - falls back to ROUTE_LABEL, so the log
 * can never be made to name a route this code does not serve.
 */
const DELEGATED_ROUTE_LABEL = '/api/payment/webhook (delegated)'
const ALLOWED_ROUTE_LABELS = [ROUTE_LABEL, DELEGATED_ROUTE_LABEL]

/**
 * Sanitise a value that came from the request for logging.
 *
 * Only [A-Za-z0-9._-] survives; any other character - a newline, a quote, a
 * space, non-ASCII, a control character - is replaced by '?'. A long value is
 * truncated. A non-string or missing value becomes 'none'.
 *
 * Without this, a caller could put a newline in the event name and forge
 * extra lines in the log, so the line can never be trusted to describe exactly
 * one request.
 */
function sanitizeLogValue(value: unknown, maxLength: number): string {
  if (typeof value !== 'string' || value.length === 0) return 'none'
  const truncated = value.length > maxLength ? value.slice(0, maxLength) : value
  let out = ''
  for (let i = 0; i < truncated.length; i++) {
    out += /[A-Za-z0-9._-]/.test(truncated[i]) ? truncated[i] : '?'
  }
  return out
}

/**
 * First 4 characters of the transaction reference, or 'none'.
 *
 * The prefix alone identifies which handler a reference will be routed to
 * (DHV-/VER-/SUB-/ADV-) without recording the full reference, which our own
 * id is embedded in. A refund event carries no data.reference at all, so its
 * prefix is taken from data.transaction_reference. The value is sanitised
 * before it can reach a log line.
 */
function referencePrefix(parsedBody: any): string {
  const data = parsedBody?.data ?? {}
  const reference =
    typeof data.reference === 'string'
      ? data.reference
      : typeof data.transaction_reference === 'string'
        ? data.transaction_reference
        : data?.transaction && typeof data.transaction.reference === 'string'
          ? data.transaction.reference
          : ''
  return sanitizeLogValue(reference.length >= 4 ? reference.slice(0, 4) : 'none', 4)
}

/**
 * Exactly one line per request, logged after the body has been parsed.
 *
 * Only the sanitised event name, the 4-character reference prefix and this
 * route's own path are ever written. The payload, the full reference,
 * amounts, emails and the signature are never logged, and nothing the caller
 * put in the body can widen what is written or add a second line.
 */
function logWebhookRoute(parsedBody: any, routeLabel: string): void {
  console.log(
    `[webhook] event=${sanitizeLogValue(parsedBody?.event, 40)} prefix=${referencePrefix(parsedBody)} route=${routeLabel}`
  )
}

/**
 * POST handler.
 *
 * The second argument is what Next.js passes a route handler: `{ params }`.
 * `params` is a (possibly promise-wrapped) object of dynamic segments, never
 * anything a client controls directly, so it is read here only to satisfy the
 * signature. An internal caller - the delegating legacy route - may pass a
 * `routeLabel` so the log says which URL the event arrived on; only the two
 * labels this file itself defines are accepted, so no caller can name an
 * arbitrary route, and nothing from the request can reach the value.
 *
 * When the second argument is absent the default label is used.
 */
export async function POST(
  request: NextRequest,
  context?: { params?: unknown; routeLabel?: string }
) {
  const requestedLabel = context?.routeLabel
  const routeLabel =
    typeof requestedLabel === 'string' && ALLOWED_ROUTE_LABELS.includes(requestedLabel)
      ? requestedLabel
      : ROUTE_LABEL
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

    logWebhookRoute(parsedBody, routeLabel)

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
      // No handler for this prefix. The single per-request log line above
      // already recorded the event and the prefix, so nothing further is
      // logged: exactly one console.log per request.
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
