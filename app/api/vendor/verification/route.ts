import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

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

    const { action, kycInfo, documents } = await request.json()

    // Check if application exists and get with payment status
    const application = await getPrisma().vendorVerificationApplication.findUnique({
      where: { vendorId: payload.userId },
    })

    if (!application) {
      return NextResponse.json({ error: 'Verification application not found. Please start the application process.' }, { status: 404 })
    }

    // Handle KYC submission - only allowed for PAID_PENDING_KYC status
    if (action === 'submit_kyc') {
      // Verify payment has been made
      if (application.status !== 'PAID_PENDING_KYC') {
        return NextResponse.json({
          error: 'KYC can only be submitted after payment is completed'
        }, { status: 400 })
      }

      // Check if KYC already exists (resubmission)
      const existingKyc = await getPrisma().vendorVerificationKYC.findUnique({
        where: { applicationId: application.id },
      })

      if (existingKyc) {
        // Update existing KYC
        await getPrisma().vendorVerificationKYC.update({
          where: { applicationId: application.id },
          data: {
            businessName: kycInfo.businessName,
            businessType: kycInfo.businessType,
            businessRegistrationNumber: kycInfo.businessRegistrationNumber,
            businessAddress: kycInfo.businessAddress,
            region: kycInfo.region,
            city: kycInfo.city,
            tinNumber: kycInfo.tinNumber,
            fullName: kycInfo.fullName,
            phoneNumber: kycInfo.phoneNumber,
            email: kycInfo.email,
            nationalIdType: kycInfo.nationalIdType,
            nationalIdNumber: kycInfo.nationalIdNumber,
          }
        })
      } else {
        // Create new KYC record
        await getPrisma().vendorVerificationKYC.create({
          data: {
            applicationId: application.id,
            businessName: kycInfo.businessName,
            businessType: kycInfo.businessType,
            businessRegistrationNumber: kycInfo.businessRegistrationNumber,
            businessAddress: kycInfo.businessAddress,
            region: kycInfo.region,
            city: kycInfo.city,
            tinNumber: kycInfo.tinNumber,
            fullName: kycInfo.fullName,
            phoneNumber: kycInfo.phoneNumber,
            email: kycInfo.email,
            nationalIdType: kycInfo.nationalIdType,
            nationalIdNumber: kycInfo.nationalIdNumber,
          }
        })
      }

      // Add/replace documents
      if (documents && documents.length > 0) {
        // Delete existing documents for this application
        await getPrisma().verificationDocument.deleteMany({
          where: { applicationId: application.id },
        })

        // Create new documents
        await getPrisma().verificationDocument.createMany({
          data: documents.map((doc: any) => ({
            applicationId: application.id,
            documentType: doc.type,
            documentUrl: doc.url,
            fileName: doc.name,
          }))
        })
      }

      // Update application status to PENDING_REVIEW
      const updatedApplication = await getPrisma().vendorVerificationApplication.update({
        where: { id: application.id },
        data: { status: 'PENDING_REVIEW' },
        include: {
          kycInfo: true,
          documents: true,
        }
      })

      // Create audit log
      await getPrisma().verificationAuditLog.create({
        data: {
          applicationId: application.id,
          action: 'KYC_SUBMITTED',
        }
      })

      return NextResponse.json({ application: updatedApplication })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing verification action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}