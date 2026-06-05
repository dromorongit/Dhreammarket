import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

// This endpoint now creates the application record but payment is handled separately
// Payment initialization should use /api/verification-payment
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden - Vendors only' }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId }
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Get verification settings
    let settings = await getPrisma().verificationSetting.findFirst({
      orderBy: { createdAt: 'asc' }
    })

    if (!settings) {
      console.warn('No VerificationSetting found, creating default settings')
      settings = await getPrisma().verificationSetting.create({
        data: {
          verificationFee: 250,
          verificationEnabled: true,
          allowResubmissionAfterRejection: true,
          autoExpirePendingApplications: false,
          expiryDays: 30,
        }
      })
    }

    if (!settings.verificationEnabled) {
      return NextResponse.json({ error: 'Verification is currently disabled' }, { status: 400 })
    }

    let application = await getPrisma().vendorVerificationApplication.findUnique({
      where: { vendorId: payload.userId }
    })

    if (!application) {
      application = await getPrisma().vendorVerificationApplication.create({
        data: {
          vendorId: payload.userId,
          storeId: store.id,
          status: 'UNPAID',
          paymentAmount: settings.verificationFee,
          paymentStatus: 'UNPAID',
        }
      })

      await getPrisma().verificationAuditLog.create({
        data: {
          applicationId: application.id,
          action: 'APPLICATION_CREATED',
        }
      })
    } else {
      // If application exists in a terminal state (APPROVED/REJECTED), allow resubmission
      if (application.status === 'APPROVED' || application.status === 'REJECTED') {
        application = await getPrisma().vendorVerificationApplication.update({
          where: { id: application.id },
          data: {
            status: 'UNPAID',
            paymentStatus: 'UNPAID',
            paymentAmount: settings.verificationFee,
            paymentReference: null,
            paymentCompletedAt: null,
          }
        })

        // Clear existing KYC and documents for resubmission
        await getPrisma().vendorVerificationKYC.deleteMany({
          where: { applicationId: application.id },
        })
        await getPrisma().verificationDocument.deleteMany({
          where: { applicationId: application.id },
        })

        await getPrisma().verificationAuditLog.create({
          data: {
            applicationId: application.id,
            action: 'VENDOR_RESUBMITTED',
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      application,
      amount: settings.verificationFee,
      enabled: settings.verificationEnabled,
      message: 'Verification application created. Please proceed to payment.',
    })
  } catch (error) {
    console.error('Error creating verification application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}