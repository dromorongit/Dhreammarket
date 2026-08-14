import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { sendEmail } from '@/lib/email'

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

    // Handle KYC submission - only allowed for PAID_PENDING_KYC or CHANGES_REQUESTED status
    if (action === 'submit_kyc') {
      // Verify payment has been made or changes were requested
      if (application.status !== 'PAID_PENDING_KYC' && application.status !== 'CHANGES_REQUESTED') {
        return NextResponse.json({
          error: 'KYC can only be submitted after payment is completed or when changes are requested'
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
        },
      })

      const store = await getPrisma().store.findUnique({
        where: { userId: payload.userId },
        select: { name: true },
      })

      const APP_URL_ADMIN = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'

      const adminSubject = `New Vendor Verification Request - ${store?.name || 'Unknown Store'}`
      const adminContent = `
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">New Vendor Verification Request</h2>
        <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">A vendor has submitted their verification application.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Store Name</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${store?.name || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Business Name</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${kycInfo.businessName}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Full Name</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${kycInfo.fullName}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Email</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${kycInfo.email}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Phone</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${kycInfo.phoneNumber}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Business Type</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${kycInfo.businessType.replace(/_/g, ' ')}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Documents</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">${documents?.length || 0} document(s) uploaded</td>
          </tr>
        </table>
<p style="margin: 0; font-size: 14px; color: #6b7280;">
          Review this application in the admin dashboard: <a href="${APP_URL_ADMIN}/dashboard/admin/verification-applications" style="color: #3b82f6;">View Verification Applications</a>
        </p>
      `
      const adminHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Verification Request</title></head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;">
    <tr><td style="padding: 32px 24px;">${adminContent}</td></tr>
  </table>
</body></html>`

      try {
        await sendEmail({
          to: 'business@dhreamarket.com',
          subject: adminSubject,
          htmlContent: adminHtml,
        })
      } catch (emailError) {
        console.error('Failed to send admin email:', emailError)
      }

      return NextResponse.json({ application: updatedApplication })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing verification action:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}