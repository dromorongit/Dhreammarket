import { initializePaystackPayment, verifyPaystackPayment, isPaystackConfigured } from '@/lib/paystack'
import { getPrisma } from '@/lib/prisma'
import { logInfo, logError } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

export interface PaystackInitializationResult {
  success: boolean
  authorizationUrl?: string
  accessCode?: string
  reference?: string
  error?: string
}

export interface PaystackVerificationResult {
  success: boolean
  status?: string
  amount?: number
  reference?: string
  error?: string
}

export async function initializeCampaignPayment(
  campaignId: string,
  vendorEmail: string,
  amount: number,
  metadata?: Record<string, any>
): Promise<PaystackInitializationResult> {
  if (!isPaystackConfigured()) {
    return { success: false, error: 'Paystack is not configured' }
  }

  const reference = `ADV-${campaignId.slice(0, 8).toUpperCase()}-${Date.now()}`

  try {
    const result = await initializePaystackPayment(
      vendorEmail,
      amount,
      reference,
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/advertising/payments/verify`,
      {
        campaignId,
        type: 'advertisement_campaign',
        ...metadata,
      }
    )

    if (result.status && result.data) {
      await logPaymentInitiation(campaignId, reference, amount)
      logInfo(`Paystack payment initialized for campaign ${campaignId}: ref=${reference}`)
      return {
        success: true,
        authorizationUrl: result.data.authorization_url,
        accessCode: result.data.access_code,
        reference: result.data.reference,
      }
    }

    return { success: false, error: result.message || 'Failed to initialize payment' }
  } catch (error: any) {
    logError(`Paystack initialization error for campaign ${campaignId}: ${error.message}`)
    return { success: false, error: error.message || 'Payment initialization failed' }
  }
}

export async function verifyCampaignPayment(reference: string): Promise<PaystackVerificationResult> {
  if (!isPaystackConfigured()) {
    return { success: false, error: 'Paystack is not configured' }
  }

  try {
    const result = await verifyPaystackPayment(reference)

    if (result.status && result.data) {
      const verification = {
        success: result.data.status === 'success',
        status: result.data.status,
        amount: result.data.amount / 100,
        reference: result.data.reference,
      }

      logInfo(`Paystack payment verified: ref=${reference}, status=${verification.status}`)
      return verification
    }

    return { success: false, error: result.message || 'Payment verification failed' }
  } catch (error: any) {
    logError(`Paystack verification error for ref=${reference}: ${error.message}`)
    return { success: false, error: error.message || 'Payment verification failed' }
  }
}

async function logPaymentInitiation(campaignId: string, reference: string, amount: number) {
  const prisma = getPrisma()
  await prisma.advertisementPayment.create({
    data: {
      campaignId,
      amount,
      currency: 'GHS',
      paystackRef: reference,
      status: 'PENDING',
      metadata: { stage: 'initiated' },
    },
  })
}