import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Tests for the LEGACY webhook path, app/api/payment/webhook/route.ts.
//
// That path must behave identically to /api/webhook/paystack, because the
// Paystack dashboard may still be configured with it: it delegates to the
// unified dispatcher rather than owning any logic of its own. Everything here
// goes through the legacy route's own POST, so a divergence between the two
// paths fails these tests. All data is obviously fake; no real secret, no real
// Paystack call and no database access.

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

let POST: typeof import('@/app/api/payment/webhook/route').POST

beforeAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = SECRET
  ;({ POST } = await import('@/app/api/payment/webhook/route'))
})

function sign(body: string, key = SECRET): string {
  return crypto.createHmac('sha512', key).update(body).digest('hex')
}

function buildRequest(body: string, signature?: string): NextRequest {
  const headers = new Headers()
  if (signature !== undefined) headers.set('x-paystack-signature', signature)
  return new NextRequest('http://localhost/api/payment/webhook', { method: 'POST', headers, body })
}

function ok() {
  return NextResponse.json({ received: true })
}

const chargeSuccess = {
  event: 'charge.success',
  data: { reference: 'DHV-ABC123', amount: 500000, status: 'success', customer: { email: 'buyer@example.invalid' } },
}

describe('POST /api/payment/webhook (legacy delegated path)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.handleOrderWebhook.mockResolvedValue(ok())
    handlers.handleVerificationWebhook.mockResolvedValue(ok())
    handlers.handleSubscriptionWebhook.mockResolvedValue(ok())
    handlers.handleAdvertisingWebhook.mockResolvedValue(ok())
    handlers.handleRefundWebhook.mockResolvedValue(ok())
  })

  it('delegates the segment config so the path stays nodejs and dynamic', async () => {
    const route = await import('@/app/api/payment/webhook/route')
    expect(route.dynamic).toBe('force-dynamic')
    expect(route.runtime).toBe('nodejs')
    expect(typeof route.POST).toBe('function')
  })

  it('passes a DHV- charge.success to handleOrderWebhook with the exact raw body and signature', async () => {
    // Insignificant whitespace included on purpose: the body must reach the
    // handler byte-for-byte, because it verifies the HMAC over the raw text.
    const body = '{\n  "event":"charge.success",\n  "data":{"reference":"DHV-ABC123","amount":500000}\n}'
    const signature = sign(body)

    const response = await POST(buildRequest(body, signature))

    expect(response.status).toBe(200)
    expect(handlers.handleOrderWebhook).toHaveBeenCalledTimes(1)
    expect(handlers.handleOrderWebhook).toHaveBeenCalledWith(body, signature)
    expect(handlers.handleRefundWebhook).not.toHaveBeenCalled()
  })

  it('routes a valid refund.* event to handleRefundWebhook with the raw body and signature', async () => {
    // The legacy route used to have no refund handling at all. Delegation is
    // what fixes that, so this is the regression that matters most.
    const body = JSON.stringify({
      event: 'refund.processed',
      data: { id: 9001, transaction_reference: 'DHV-ABC123', status: 'processed', amount: 25000 },
    })
    const signature = sign(body)

    const response = await POST(buildRequest(body, signature))

    expect(response.status).toBe(200)
    expect(handlers.handleRefundWebhook).toHaveBeenCalledTimes(1)
    expect(handlers.handleRefundWebhook).toHaveBeenCalledWith(body, signature)
    expect(handlers.handleOrderWebhook).not.toHaveBeenCalled()
  })

  it('rejects a refund.* event with an invalid signature with 401 and calls no handler', async () => {
    const body = JSON.stringify({
      event: 'refund.pending',
      data: { id: 9002, transaction_reference: 'DHV-ABC123' },
    })
    const forged = sign(body, 'sk_test_some_other_handler_key_9999')

    const response = await POST(buildRequest(body, forged))

    expect(response.status).toBe(401)
    expect(handlers.handleRefundWebhook).not.toHaveBeenCalled()
    expect(handlers.handleOrderWebhook).not.toHaveBeenCalled()
    expect(handlers.handleVerificationWebhook).not.toHaveBeenCalled()
    expect(handlers.handleSubscriptionWebhook).not.toHaveBeenCalled()
    expect(handlers.handleAdvertisingWebhook).not.toHaveBeenCalled()
  })

  it('rejects a refund.* event with no signature header at all with 401 and calls no handler', async () => {
    const body = JSON.stringify({
      event: 'refund.failed',
      data: { id: 9003, transaction_reference: 'DHV-ABC123' },
    })

    const response = await POST(buildRequest(body))

    expect(response.status).toBe(401)
    expect(handlers.handleRefundWebhook).not.toHaveBeenCalled()
    expect(handlers.handleOrderWebhook).not.toHaveBeenCalled()
  })

  it('acknowledges an unknown event with 200 and calls no handler', async () => {
    const body = JSON.stringify({
      event: 'charge.dispute.create',
      data: { reference: 'ZZZ-UNKNOWN123', amount: 1000 },
    })
    // No signature: the dispatcher acknowledges unknown references without
    // verifying, exactly as the unified route does.
    const response = await POST(buildRequest(body))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.received).toBe(true)
    expect(handlers.handleOrderWebhook).not.toHaveBeenCalled()
    expect(handlers.handleRefundWebhook).not.toHaveBeenCalled()
    expect(handlers.handleVerificationWebhook).not.toHaveBeenCalled()
    expect(handlers.handleSubscriptionWebhook).not.toHaveBeenCalled()
    expect(handlers.handleAdvertisingWebhook).not.toHaveBeenCalled()
  })

  it('never logs the payload, the full reference, amounts, emails or the signature', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const body = JSON.stringify({
        event: 'charge.success',
        data: {
          reference: 'DHV-SECRET-REFERENCE-12345',
          amount: 987654,
          customer: { email: 'buyer@example.invalid', first_name: 'Buyer' },
        },
      })
      const signature = sign(body)

      await POST(buildRequest(body, signature))

      const logged = [...logSpy.mock.calls, ...errorSpy.mock.calls]
        .map(call => call.map(part => String(part)).join(' '))
        .join('\n')

      // Exactly one webhook line per request, and it carries only the three
      // permitted fields.
      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(logSpy.mock.calls[0][0]).toBe(
        '[webhook] event=charge.success prefix=DHV- route=/api/payment/webhook (delegated)'
      )

      expect(logged).not.toContain('DHV-SECRET-REFERENCE-12345')
      expect(logged).not.toContain('SECRET-REFERENCE')
      expect(logged).not.toContain('987654')
      expect(logged).not.toContain('buyer@example.invalid')
      expect(logged).not.toContain('Buyer')
      expect(logged).not.toContain('first_name')
      expect(logged).not.toContain(signature)
      expect(logged).not.toContain(SECRET)
    } finally {
      logSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })
})
