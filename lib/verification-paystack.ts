// Paystack payment integration for Vendor Verification
import crypto from 'crypto'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co'

export interface VerificationPaystackInitializeResponse {
  status: boolean
  message: string
  data: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

export interface VerificationPaystackVerifyResponse {
  status: boolean
  message: string
  data: {
    reference: string
    amount: number
    currency: string
    status: string
    customer: {
      email: string
      first_name: string
      last_name: string
      phone: string | null
    }
    metadata: any
  }
}

/**
 * Check if Paystack is properly configured
 */
export function isPaystackConfigured(): boolean {
  return !!PAYSTACK_SECRET_KEY && PAYSTACK_SECRET_KEY !== 'sk_test_your_secret_key'
}

/**
 * Initialize a Paystack payment for vendor verification
 */
export async function initializeVerificationPayment(
  email: string,
  amount: number, // Amount in GHS
  reference: string,
  callbackUrl: string,
  metadata?: Record<string, any>
): Promise<VerificationPaystackInitializeResponse> {
  console.log('[Verification Paystack] Initialize payment - email:', email, 'amount:', amount, 'reference:', reference)

  if (!PAYSTACK_SECRET_KEY) {
    const error = 'Paystack secret key is not configured'
    console.error('[Verification Paystack] CRITICAL ERROR:', error)
    throw new Error(error)
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100), // Convert GHS to pesewas (smallest unit)
      reference,
      callback_url: callbackUrl,
      metadata: metadata || {},
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    const errorDetails = {
      status: response.status,
      statusText: response.statusText,
      data: data,
      message: data.message || data.error || 'Failed to initialize payment'
    }
    console.error('[Verification Paystack] Initialize API error:', errorDetails)
    throw new Error(`Paystack initialization failed: ${errorDetails.message} (Status: ${response.status})`)
  }

  console.log('[Verification Paystack] Initialize response received:', {
    authorization_url: data.data?.authorization_url,
    reference: data.data?.reference,
    status: data.status
  })

  return data
}

/**
 * Verify a Paystack payment for vendor verification
 */
export async function verifyVerificationPayment(reference: string): Promise<VerificationPaystackVerifyResponse> {
  console.log('[Verification Paystack] Verify payment - reference:', reference)

  if (!PAYSTACK_SECRET_KEY) {
    const error = 'Paystack secret key is not configured'
    console.error('[Verification Paystack] CRITICAL ERROR:', error)
    throw new Error(error)
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    const errorDetails = {
      status: response.status,
      statusText: response.statusText,
      data: data,
      message: data.message || data.error || 'Failed to verify payment'
    }
    console.error('[Verification Paystack] Verify API error:', errorDetails)
    throw new Error(`Paystack verification failed: ${errorDetails.message} (Status: ${response.status})`)
  }

  console.log('[Verification Paystack] Verify response received - status:', data.data?.status)

  return data
}

/**
 * Generate a unique payment reference for verification
 */
export function generateVerificationReference(): string {
  return `VER-${crypto.randomBytes(8).toString('hex').toUpperCase()}`
}

/**
 * Verify webhook signature from Paystack
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY || '')
    .update(payload)
    .digest('hex')

  return signature === expectedSignature
}