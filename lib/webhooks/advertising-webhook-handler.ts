import { NextResponse } from 'next/server'
import crypto from 'crypto'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

function verifyPaystackSignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false
  if (!PAYSTACK_SECRET_KEY) return false

  const expectedSignature = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}

export async function handleAdvertisingWebhook(body: string, signature: string | undefined): Promise<NextResponse> {
  if (!verifyPaystackSignature(body, signature ?? undefined)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const parsedBody = JSON.parse(body)
  const reference = parsedBody.data?.reference

  console.log('[Advertising Webhook] Received event for reference:', reference, '- advertising webhook not yet implemented')

  return NextResponse.json({ error: 'Advertising webhook not implemented' }, { status: 501 })
}
