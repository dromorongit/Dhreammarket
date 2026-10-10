// Paystack payment integration utilities
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co'

export interface PaystackInitializeResponse {
  status: boolean
  message: string
  data: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

export interface PaystackVerifyResponse {
  status: boolean
  message: string
  data: {
    reference: string
    amount: number
    currency: string
    status: string
    fees?: number
    customer: {
      email: string
      first_name: string
      last_name: string
      phone: string | null
    }
    metadata: any
  }
}

export interface PaystackRefund {
  id: number
  reference: string | null
  amount: number
  currency: string
  status: string
  transactionReference: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type PaystackRefundErrorCode = 'NOT_CONFIGURED' | 'TIMEOUT' | 'NETWORK_ERROR' | 'API_ERROR'

export interface PaystackRefundError {
  code: PaystackRefundErrorCode
  message: string
  httpStatus?: number
}

export interface PaystackRefundResult {
  success: boolean
  refund?: PaystackRefund
  error?: PaystackRefundError
}

export interface PaystackRefundListResult {
  success: boolean
  refunds: PaystackRefund[]
  error?: PaystackRefundError
}

export interface PaystackRetryRefundOptions {
  currency?: string
  customerNote?: string
  merchantNote?: string
}

const PAYSTACK_TIMEOUT_MS = 15000

/**
  * Initialize a Paystack payment transaction
  */
 export async function initializePaystackPayment(
   email: string,
   amount: number, // Amount in GHS (smallest currency unit - pesewas)
   reference: string,
   callbackUrl?: string,
   metadata?: Record<string, any>
 ): Promise<PaystackInitializeResponse> {
  console.log('[Paystack] Initialize payment started - email:', email, 'amount:', amount, 'reference:', reference)
  
  if (!PAYSTACK_SECRET_KEY) {
    const error = 'Paystack secret key is not configured'
    console.error('[Paystack] CRITICAL ERROR:', error)
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
    console.error('[Paystack] Initialize API error:', errorDetails)
    throw new Error(`Paystack initialization failed: ${errorDetails.message} (Status: ${response.status})`)
  }

  console.log('[Paystack] Initialize response received:', {
    authorization_url: data.data?.authorization_url,
    reference: data.data?.reference,
    status: data.status
  })
  
  return data
}

/**
  * Verify a Paystack payment transaction
  */
export async function verifyPaystackPayment(reference: string): Promise<PaystackVerifyResponse> {
  console.log('[Paystack] Verify payment started - reference:', reference)
  
  if (!PAYSTACK_SECRET_KEY) {
    const error = 'Paystack secret key is not configured'
    console.error('[Paystack] CRITICAL ERROR:', error)
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
    console.error('[Paystack] Verify API error:', errorDetails)
    throw new Error(`Paystack verification failed: ${errorDetails.message} (Status: ${response.status})`)
  }

  console.log('[Paystack] Verify response received:', {
    status: data.data?.status,
    reference: data.data?.reference,
    amount: data.data?.amount
  })
  
  return data
}

/**
  * Check if Paystack is properly configured
  */
export function isPaystackConfigured(): boolean {
  return !!PAYSTACK_SECRET_KEY && PAYSTACK_SECRET_KEY !== 'sk_test_your_secret_key'
}

// The four refund helpers below replaced the old unconditional startup logs,
// which printed the presence of the secret/public keys on every cold start.
// One boolean-only line is emitted on first use instead, and it carries no key
// material of any kind - not the key, not a prefix, not a length.
let loggedConfiguration = false
function logConfigurationOnce(): void {
  if (loggedConfiguration) return
  loggedConfiguration = true
  console.log('[Paystack] Configured:', isPaystackConfigured())
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (error as any)?.name === 'AbortError'
  )
}

function mapPaystackRefund(data: any): PaystackRefund {
  const transactionReference =
    typeof data?.transaction_reference === 'string'
      ? data.transaction_reference
      : typeof data?.transaction?.reference === 'string'
        ? data.transaction.reference
        : null

  return {
    id: Number(data?.id || 0),
    reference: typeof data?.reference === 'string' ? data.reference : null,
    amount: Number(data?.amount || 0),
    currency: typeof data?.currency === 'string' ? data.currency : 'GHS',
    status: typeof data?.status === 'string' ? data.status : 'unknown',
    transactionReference,
    createdAt: typeof data?.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : null,
  }
}

function refundErrorResult(
  code: PaystackRefundErrorCode,
  message: string,
  httpStatus?: number
): PaystackRefundResult {
  return { success: false, error: { code, message, httpStatus } }
}

function refundListErrorResult(
  code: PaystackRefundErrorCode,
  message: string,
  httpStatus?: number
): PaystackRefundListResult {
  return { success: false, refunds: [], error: { code, message, httpStatus } }
}

/**
  * Create a refund for a Paystack transaction.
  * Amount must be supplied in pesewas (integer). Uses a 15s timeout with no
  * automatic retries. Never logs the request or response body.
  */
export async function createPaystackRefund(
  transactionReference: string,
  amountInPesewas: number,
  options: PaystackRetryRefundOptions = {}
): Promise<PaystackRefundResult> {
  logConfigurationOnce()
  if (!PAYSTACK_SECRET_KEY) {
    return refundErrorResult('NOT_CONFIGURED', 'Paystack secret key is not configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS)

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: transactionReference,
        amount: Math.round(amountInPesewas),
        currency: options.currency || 'GHS',
        customer_note: options.customerNote,
        merchant_note: options.merchantNote,
      }),
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        (data && (data.message || data.error)) ||
        `Paystack refund request failed (HTTP ${response.status})`
      return refundErrorResult('API_ERROR', String(message), response.status)
    }

    return { success: true, refund: mapPaystackRefund(data?.data) }
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      return refundErrorResult('TIMEOUT', 'Paystack refund request timed out')
    }
    return refundErrorResult(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Paystack refund request failed'
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
  * List Paystack refunds for a transaction reference.
  * GET /refund?reference=<transaction reference>. Never logs the response body.
  */
export async function listPaystackRefunds(
  transactionReference: string
): Promise<PaystackRefundListResult> {
  logConfigurationOnce()
  if (!PAYSTACK_SECRET_KEY) {
    return refundListErrorResult('NOT_CONFIGURED', 'Paystack secret key is not configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS)

  try {
    const url = `${PAYSTACK_BASE_URL}/refund?reference=${encodeURIComponent(transactionReference)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        (data && (data.message || data.error)) ||
        `Paystack refund list request failed (HTTP ${response.status})`
      return refundListErrorResult('API_ERROR', String(message), response.status)
    }

    const list = Array.isArray(data?.data) ? data.data : []
    return { success: true, refunds: list.map(mapPaystackRefund) }
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      return refundListErrorResult('TIMEOUT', 'Paystack refund list request timed out')
    }
    return refundListErrorResult(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Paystack refund list request failed'
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
  * Fetch a single Paystack refund by its refund id.
  * Never logs the response body.
  */
export async function fetchPaystackRefund(refundId: number | string): Promise<PaystackRefundResult> {
  logConfigurationOnce()
  if (!PAYSTACK_SECRET_KEY) {
    return refundErrorResult('NOT_CONFIGURED', 'Paystack secret key is not configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS)

  try {
    const url = `${PAYSTACK_BASE_URL}/refund/${encodeURIComponent(String(refundId))}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        (data && (data.message || data.error)) ||
        `Paystack refund fetch failed (HTTP ${response.status})`
      return refundErrorResult('API_ERROR', String(message), response.status)
    }

    return { success: true, refund: mapPaystackRefund(data?.data) }
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      return refundErrorResult('TIMEOUT', 'Paystack refund fetch timed out')
    }
    return refundErrorResult(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Paystack refund fetch failed'
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
  * Retry a needs-attention Paystack refund with corrected customer account
  * details. The details are passed straight to Paystack and are never logged
  * or stored. Uses a 15s timeout with no automatic retries.
  */
export async function retryPaystackRefundWithCustomerDetails(
  refundId: number | string,
  customerDetails: Record<string, any>
): Promise<PaystackRefundResult> {
  logConfigurationOnce()
  if (!PAYSTACK_SECRET_KEY) {
    return refundErrorResult('NOT_CONFIGURED', 'Paystack secret key is not configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS)

  try {
    const url = `${PAYSTACK_BASE_URL}/refund/${encodeURIComponent(String(refundId))}/retry`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerDetails),
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        (data && (data.message || data.error)) ||
        `Paystack refund retry failed (HTTP ${response.status})`
      return refundErrorResult('API_ERROR', String(message), response.status)
    }

    return { success: true, refund: mapPaystackRefund(data?.data) }
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      return refundErrorResult('TIMEOUT', 'Paystack refund retry timed out')
    }
    return refundErrorResult(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Paystack refund retry failed'
    )
  } finally {
    clearTimeout(timeout)
  }
}
