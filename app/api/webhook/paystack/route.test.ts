import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const handlers = vi.hoisted(() => ({
  handleOrderWebhook: vi.fn(),
  handleVerificationWebhook: vi.fn(),
  handleSubscriptionWebhook: vi.fn(),
  handleAdvertisingWebhook: vi.fn(),
  handleRefundWebhook: vi.fn(),
}))

vi.mock('@/lib/webhooks/order-webhook-handler', () => ({ handleOrderWebhook: handlers.handleOrderWebhook }))
vi.mock('@/lib/webhooks/verification-webhook-handler', () => ({ handleVerificationWebhook: handlers.handleVerificationWebhook }))
vi.mock('@/lib/webhooks/subscription-webhook-handler', () => ({ handleSubscriptionWebhook: handlers.handleSubscriptionWebhook }))
vi.mock('@/lib/webhooks/advertising-webhook-handler', () => ({ handleAdvertisingWebhook: handlers.handleAdvertisingWebhook }))
vi.mock('@/lib/webhooks/refund-webhook-handler', () => ({
  handleRefundWebhook: handlers.handleRefundWebhook,
  // Real behaviour: only names starting with 'refund.' match.
  isRefundEvent: (event: string | undefined) => typeof event === 'string' && event.startsWith('refund.'),
}))

const SECRET = 'sk_test_webhook_route_key_0002'
// A different handler may legitimately be configured with its own key.
const OTHER_SECRET = 'sk_test_some_other_handler_key_9999'

let POST: typeof import('@/app/api/webhook/paystack/route').POST

beforeAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = SECRET
  ;({ POST } = await import('@/app/api/webhook/paystack/route'))
})

function sign(body: string, key = SECRET): string {
  return crypto.createHmac('sha512', key).update(body).digest('hex')
}

function buildRequest(body: string, signature?: string, header = 'x-paystack-signature'): NextRequest {
  const headers = new Headers()
  if (signature !== undefined) headers.set(header, signature)
  return new NextRequest('http://localhost/api/webhook/paystack', { method: 'POST', headers, body })
}

function ok() {
  return NextResponse.json({ received: true })
}

describe('Paystack webhook dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.handleOrderWebhook.mockResolvedValue(ok())
    handlers.handleVerificationWebhook.mockResolvedValue(ok())
    handlers.handleSubscriptionWebhook.mockResolvedValue(ok())
    handlers.handleAdvertisingWebhook.mockResolvedValue(ok())
    handlers.handleRefundWebhook.mockResolvedValue(ok())
  })

  // ---------------------------------------------------------------------
  // Refund.* events: the ONLY events this route verifies itself.
  // ---------------------------------------------------------------------

  it('rejects an invalid signature on a refund.* event with 401 and calls no handler', async () => {
    const body = JSON.stringify({
      event: 'refund.processed',
      data: { id: 9001, transaction_reference: 'DHV-ABC123', status: 'processed' },
    })

    const response = await POST(buildRequest(body, 'deadbeef'))

    expect(response.status).toBe(401)
    expect((await response.json()).error).toBe('Invalid signature')
    for (const handler of Object.values(handlers)) {
      expect(handler).not.toHaveBeenCalled()
    }
  })

  it('rejects a missing signature on a refund.* event with 401 and calls no handler', async () => {
    const body = JSON.stringify({
      event: 'refund.pending',
      data: { transaction_reference: 'DHV-ABC123' },
    })

    const response = await POST(buildRequest(body, undefined))

    expect(response.status).toBe(401)
    expect(handlers.handleRefundWebhook).not.toHaveBeenCalled()
    expect(handlers.handleOrderWebhook).not.toHaveBeenCalled()
  })

  it('hands a valid refund.* event to the refund handler with the raw body and signature', async () => {
    const body = JSON.stringify({
      event: 'refund.processed',
      data: { id: 9001, transaction_reference: 'DHV-ABC123', status: 'processed' },
    })
    const signature = sign(body)

    const response = await POST(buildRequest(body, signature))

    expect(response.status).toBe(200)
    // Exactly the bytes we received, for the handler's own verification.
    expect(handlers.handleRefundWebhook).toHaveBeenCalledWith(body, signature)
    expect(handlers.handleOrderWebhook).not.toHaveBeenCalled()
    expect(handlers.handleVerificationWebhook).not.toHaveBeenCalled()
    expect(handlers.handleSubscriptionWebhook).not.toHaveBeenCalled()
    expect(handlers.handleAdvertisingWebhook).not.toHaveBeenCalled()
  })

  it('routes refund.* events ahead of the DHV-/VER-/SUB-/ADV- prefix logic', async () => {
    // A refund event has no data.reference at all, only the transaction
    // reference - it must not fall through to the prefix routing.
    const body = JSON.stringify({
      event: 'refund.processed',
      data: { id: 9001, transaction_reference: 'DHV-ABC123', status: 'processed' },
    })

    const response = await POST(buildRequest(body, sign(body)))

    expect(response.status).toBe(200)
    expect(handlers.handleRefundWebhook).toHaveBeenCalledTimes(1)
    expect(handlers.handleOrderWebhook).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------
  // DHV- / VER- / SUB- / ADV- events: NOT verified by this route.
  // ---------------------------------------------------------------------

  describe('DHV-/VER-/SUB-/ADV- events keep their own in-handler verification', () => {
    const cases = [
      ['DHV-', 'handleOrderWebhook'],
      ['VER-', 'handleVerificationWebhook'],
      ['SUB-', 'handleSubscriptionWebhook'],
      ['ADV-', 'handleAdvertisingWebhook'],
    ] as const

    for (const [prefix, handlerName] of cases) {
      it(`passes a valid charge.success for a ${prefix} reference to ${handlerName} unchanged`, async () => {
        const body = JSON.stringify({ event: 'charge.success', data: { reference: `${prefix}ABC123` } })
        const signature = sign(body)

        const response = await POST(buildRequest(body, signature))

        expect(response.status).toBe(200)
        // Same handler, same raw body, same signature header value.
        expect(handlers[handlerName]).toHaveBeenCalledWith(body, signature)
        // No other handler was reached.
        for (const [otherName, other] of Object.entries(handlers)) {
          if (otherName !== handlerName) expect(other).not.toHaveBeenCalled()
        }
      })
    }

    it('does not verify the signature for a DHV- event, so the order handler still owns that decision', async () => {
      // An invalid signature is passed straight through: the handler returns 401
      // itself, which is where it was before this route was changed.
      handlers.handleOrderWebhook.mockResolvedValue(
        NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      )
      const body = JSON.stringify({ event: 'charge.success', data: { reference: 'DHV-ABC123' } })

      const response = await POST(buildRequest(body, 'deadbeef'))

      expect(response.status).toBe(401)
      expect(handlers.handleOrderWebhook).toHaveBeenCalledWith(body, 'deadbeef')
      expect(handlers.handleRefundWebhook).not.toHaveBeenCalled()
    })

    it('does not 401 a valid event for a handler that uses a different secret', async () => {
      // The route's own PAYSTACK_SECRET_KEY is SECRET; this event is signed with
      // OTHER_SECRET, which is what the target handler is configured with.
      // Verifying at route level would wrongly reject it with a 401.
      const body = JSON.stringify({ event: 'charge.success', data: { reference: 'DHV-ABC123' } })
      const signature = sign(body, OTHER_SECRET)

      const response = await POST(buildRequest(body, signature))

      expect(response.status).toBe(200)
      expect(handlers.handleOrderWebhook).toHaveBeenCalledWith(body, signature)
    })

    it('forwards a VER- event with no signature at all, as the verification handler did before', async () => {
      // handleVerificationWebhook returns 400 for a missing signature; the route
      // must not turn that into a 401 before the handler ever ran.
      handlers.handleVerificationWebhook.mockResolvedValue(
        NextResponse.json({ error: 'Missing signature' }, { status: 400 })
      )
      const body = JSON.stringify({ event: 'charge.success', data: { reference: 'VER-XYZ' } })

      const response = await POST(buildRequest(body, undefined))

      expect(response.status).toBe(400)
      expect(handlers.handleVerificationWebhook).toHaveBeenCalledWith(body, undefined)
    })

    it('forwards the exact raw body, including insignificant whitespace', async () => {
      // Re-serialising the parsed body would break every handler's HMAC check,
      // so the dispatcher must hand over the original bytes.
      const body = JSON.stringify({ event: 'charge.success', data: { reference: 'SUB-XYZ' } }, null, 2)
      const signature = sign(body)

      await POST(buildRequest(body, signature))

      expect(handlers.handleSubscriptionWebhook).toHaveBeenCalledWith(body, signature)
    })
  })

  it('acknowledges an unknown reference type without calling a handler', async () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ZZZ-1' } })

    const response = await POST(buildRequest(body, sign(body)))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.warning ?? json.message).toBeDefined()
    for (const handler of Object.values(handlers)) {
      expect(handler).not.toHaveBeenCalled()
    }
  })

  it('does not verify the signature for an unknown reference either', async () => {
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ZZZ-1' } })

    const response = await POST(buildRequest(body, 'deadbeef'))

    expect(response.status).toBe(200)
  })

  it('returns 400 when the body is not JSON', async () => {
    const body = 'not json at all'

    const response = await POST(buildRequest(body, sign(body)))

    expect(response.status).toBe(400)
    expect(handlers.handleRefundWebhook).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty body', async () => {
    const response = await POST(buildRequest('', undefined))

    expect(response.status).toBe(400)
    for (const handler of Object.values(handlers)) {
      expect(handler).not.toHaveBeenCalled()
    }
  })

  it('returns 400 when data.reference is missing on a non-refund event', async () => {
    const body = JSON.stringify({ event: 'charge.success', data: {} })

    const response = await POST(buildRequest(body, sign(body)))

    expect(response.status).toBe(400)
  })
})
