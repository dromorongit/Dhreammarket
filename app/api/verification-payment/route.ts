// Payment initialization endpoint for vendor verification using Paystack
import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { initializeVerificationPayment, generateVerificationReference, isPaystackConfigured } from '@/lib/verification-paystack'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  console.log('[Verification Payment API] Request received')

  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden - Vendors only' }, { status: 403 })
    }

    // Check if Paystack is configured
    if (!isPaystackConfigured()) {
      console.error('[Verification Payment API] CRITICAL: Paystack not configured')
      return NextResponse.json({
        error: 'Payment system not configured. Please contact support.'
      }, { status: 500 })
    }

    // Get store
    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Get user email
    const user = await getPrisma().user.findUnique({
      where: { id: payload.userId },
      select: { email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get or create verification settings
    let settings = await getPrisma().verificationSetting.findFirst({
      orderBy: { createdAt: 'asc' },
    })

    if (!settings) {
      console.warn('[Verification Payment API] No VerificationSetting found, creating default settings')
      settings = await getPrisma().verificationSetting.create({
        data: {
          verificationFee: 250,
          verificationEnabled: true,
          allowResubmissionAfterRejection: true,
          autoExpirePendingApplications: false,
          expiryDays: 30,
        },
      })
    }

    if (!settings.verificationEnabled) {
      return NextResponse.json({ error: 'Verification is currently disabled' }, { status: 400 })
    }

    // Get or create verification application
    let application = await getPrisma().vendorVerificationApplication.findUnique({
      where: { vendorId: payload.userId },
    })

    // Generate payment reference
    const paymentReference = generateVerificationReference()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
    const callbackUrl = `${appUrl}/dashboard/vendor/verification`

    if (!appUrl) {
      console.error('[Verification Payment API] CRITICAL ERROR: APP_URL is not configured. Set NEXT_PUBLIC_APP_URL or APP_URL environment variable.')
    }

    if (!application) {
      // Create new application in UNPAID state
      application = await getPrisma().vendorVerificationApplication.create({
        data: {
          vendorId: payload.userId,
          storeId: store.id,
          status: 'UNPAID',
          paymentReference,
          paymentAmount: settings.verificationFee,
          paymentStatus: 'UNPAID',
        },
      })

      // Create audit log for application created
      await getPrisma().verificationAuditLog.create({
        data: {
          applicationId: application.id,
          action: 'APPLICATION_CREATED',
        },
      })

      // Create verification payment record
      await getPrisma().verificationPayment.create({
        data: {
          applicationId: application.id,
          reference: paymentReference,
          amount: settings.verificationFee,
          status: 'UNPAID',
        },
      })
    } else if (application.status === 'UNPAID' || application.status === 'REJECTED') {
      // Only allow re-initialization for UNPAID or REJECTED applications
      application = await getPrisma().vendorVerificationApplication.update({
        where: { id: application.id },
        data: {
          status: 'UNPAID',
          paymentReference,
          paymentAmount: settings.verificationFee,
          paymentStatus: 'UNPAID',
        },
      })

      // Check if payment record exists and update or create accordingly
      const existingPayment = await getPrisma().verificationPayment.findUnique({
        where: { applicationId: application.id },
      })

      if (existingPayment) {
        // Update existing payment record
        await getPrisma().verificationPayment.update({
          where: { applicationId: application.id },
          data: {
            reference: paymentReference,
            amount: settings.verificationFee,
            status: 'UNPAID',
            paystackRef: null,
            completedAt: null,
          },
        })
      } else {
        // Create new payment record
        await getPrisma().verificationPayment.create({
          data: {
            applicationId: application.id,
            reference: paymentReference,
            amount: settings.verificationFee,
            status: 'UNPAID',
          },
        })
      }

      // Create audit log for payment re-initiated
      await getPrisma().verificationAuditLog.create({
        data: {
          applicationId: application.id,
          action: 'PAYMENT_REINITIATED',
        },
      })
    } else {
      // Application exists in a state where payment re-initialization is not allowed
      // (e.g., PENDING_REVIEW, APPROVED, CHANGES_REQUESTED)
      return NextResponse.json({
        success: true,
        application,
        message: 'Application status: ' + application.status.replace(/_/g, ' ')
      })
    }

    // Initialize Paystack payment
    const paystackResponse = await initializeVerificationPayment(
      user.email,
      settings.verificationFee,
      paymentReference,
      callbackUrl,
      {
        applicationId: application.id,
        vendorId: payload.userId,
        storeId: store.id,
        type: 'vendor_verification',
      }
    )

    // Update application with Paystack reference
    await getPrisma().vendorVerificationApplication.update({
      where: { id: application.id },
      data: {
        paystackRef: paystackResponse.data.reference,
      },
    })

    // Update verification payment with Paystack reference
    await getPrisma().verificationPayment.update({
      where: { reference: paymentReference },
      data: {
        paystackRef: paystackResponse.data.reference,
      },
    })

    console.log('[Verification Payment API] Payment initialized - reference:', paymentReference)

    return NextResponse.json({
      success: true,
      application,
      paymentReference,
      authorizationUrl: paystackResponse.data.authorization_url,
      amount: settings.verificationFee,
    })

  } catch (error) {
    console.error('[Verification Payment API] Error initializing payment:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to initialize payment'
    }, { status: 500 })
  }
}