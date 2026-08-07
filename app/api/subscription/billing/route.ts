import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { initializeBillingPayment, verifyBillingPayment, createManualRenewalInvoice, processManualPayment } from '@/lib/subscription/billing-service'
import { getPrisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'initializePayment': {
        const { planName, billingCycle, vendorEmail, callbackUrl } = body
        if (!planName) {
          return NextResponse.json({ error: 'Plan name required' }, { status: 400 })
        }

        let email = vendorEmail
        if (!email) {
          const vendor = await getPrisma().user.findUnique({
            where: { id: payload.userId },
            select: { email: true },
          })
          if (!vendor) {
            return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
          }
          email = vendor.email
        }

        // The authoritative plan price is resolved server-side from the database
        // inside initializeBillingPayment - a frontend-supplied amount is never trusted.
        const result = await initializeBillingPayment(
          payload.userId,
          email,
          planName,
          billingCycle || 'MONTHLY',
          callbackUrl
        )

        if (!result.success) {
          logError('Billing payment initialization failed', undefined, { vendorId: payload.userId, planName, error: result.error })
          return NextResponse.json({ error: result.error || 'Failed to initialize payment' }, { status: 502 })
        }

        return NextResponse.json({
          success: true,
          authorizationUrl: result.authorizationUrl,
          accessCode: result.accessCode,
          reference: result.reference,
          amount: result.amount,
          currency: result.currency,
          planName,
          billingCycle: billingCycle || 'MONTHLY',
        })
      }

      case 'verifyPayment': {
        const { reference } = body
        if (!reference) {
          return NextResponse.json({ error: 'Payment reference required' }, { status: 400 })
        }
        const result = await verifyBillingPayment(reference)
        return NextResponse.json(result)
      }

      case 'manualRenewalInvoice': {
        const { subscriptionId } = body
        if (!subscriptionId) {
          return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 })
        }
        const invoice = await createManualRenewalInvoice(subscriptionId)
        return NextResponse.json({ invoice }, { status: 201 })
      }

      case 'manualPayment': {
        const { subscriptionId, amount, paymentMethod } = body
        if (!subscriptionId || !amount || amount <= 0) {
          return NextResponse.json({ error: 'Subscription ID and valid amount required' }, { status: 400 })
        }
        const result = await processManualPayment(subscriptionId, amount, paymentMethod || 'MANUAL')
        return NextResponse.json({ result })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
   } catch (error) {
    logError('Error in billing endpoint:', error)
    // Surface the safe, real reason instead of masking it as a generic 500.
    // These messages never include secrets (the Paystack key is never part of them).
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}