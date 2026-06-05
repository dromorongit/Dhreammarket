// Payment verification endpoint for vendor verification
import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { verifyVerificationPayment } from '@/lib/verification-paystack'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  console.log('[Verification Payment Verify API] Request received')

  try {
    const { reference } = await request.json()
    console.log('[Verification Payment Verify API] Reference received:', reference)

    if (!reference) {
      return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 })
    }

    // Find the verification payment record
    const payment = await getPrisma().verificationPayment.findUnique({
      where: { reference },
      include: {
        application: true,
      },
    })

    if (!payment) {
      console.log('[Verification Payment Verify API] Payment not found for reference:', reference)
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Already verified - idempotency protection
    if (payment.status === 'PAID') {
      console.log('[Verification Payment Verify API] Payment already verified')
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        applicationId: payment.applicationId,
        status: payment.application.status,
      })
    }

    // Verify payment with Paystack
    console.log('[Verification Payment Verify API] Verifying with Paystack')
    const paystackResponse = await verifyVerificationPayment(reference)
    console.log('[Verification Payment Verify API] Paystack response - status:', paystackResponse.data.status)

    // Check payment status
    if (paystackResponse.data.status !== 'success') {
      // Payment failed, abandoned, or cancelled
      const failedStatus = paystackResponse.data.status === 'abandoned' ? 'FAILED' : 'FAILED'

      await getPrisma().$transaction(async (prisma: any) => {
        await prisma.verificationPayment.update({
          where: { id: payment.id },
          data: {
            status: failedStatus,
          },
        })

        await prisma.vendorVerificationApplication.update({
          where: { id: payment.applicationId },
          data: {
            status: 'UNPAID',
            paymentStatus: 'FAILED',
          },
        })
      })

      return NextResponse.json({
        success: false,
        error: paystackResponse.data.status === 'abandoned' ? 'Payment was cancelled' : 'Payment verification failed',
      }, { status: 400 })
    }

    // Payment successful - update records
    await getPrisma().$transaction(async (prisma: any) => {
      // Update payment status to PAID
      await prisma.verificationPayment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          completedAt: new Date(),
        },
      })

      // Update application status to PAID_PENDING_KYC
      await prisma.vendorVerificationApplication.update({
        where: { id: payment.applicationId },
        data: {
          status: 'PAID_PENDING_KYC',
          paymentStatus: 'PAID',
          paymentCompletedAt: new Date(),
        },
      })

      // Create audit log
      await prisma.verificationAuditLog.create({
        data: {
          applicationId: payment.applicationId,
          action: 'PAYMENT_SUCCESSFUL',
        },
      })
    })

    console.log('[Verification Payment Verify API] Payment verified successfully - applicationId:', payment.applicationId)

    return NextResponse.json({
      success: true,
      applicationId: payment.applicationId,
      status: 'PAID_PENDING_KYC',
    })

  } catch (error) {
    console.error('[Verification Payment Verify API] Error verifying payment:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to verify payment'
    }, { status: 500 })
  }
}