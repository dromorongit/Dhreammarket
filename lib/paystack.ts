// Paystack payment integration utilities
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co'

// RUNTIME LOGGING - Critical for Railway environment verification
console.log('[Paystack] Secret key exists:', !!PAYSTACK_SECRET_KEY)
console.log('[Paystack] Public key exists:', !!PAYSTACK_PUBLIC_KEY)
console.log('[Paystack] Base URL:', PAYSTACK_BASE_URL)

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