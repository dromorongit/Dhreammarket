import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (status) where.status = status

    const applications = await getPrisma().vendorVerificationApplication.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              }
            }
          }
        },
        store: {
          select: {
            id: true,
            name: true,
          }
        },
        documents: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    const total = await getPrisma().vendorVerificationApplication.count({ where })

    return NextResponse.json({
      applications,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    console.error('Error fetching verification applications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId }
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Check if application exists
    let application = await getPrisma().vendorVerificationApplication.findUnique({
      where: { vendorId: payload.userId }
    })

    if (!application) {
      application = await getPrisma().vendorVerificationApplication.create({
        data: {
          vendorId: payload.userId,
          storeId: store.id,
          status: 'NOT_APPLIED',
        }
      })
    }

    // Handle payment initiation
    if (action === 'initiate_payment') {
      const settings = await getPrisma().verificationSetting.findFirst()
      if (!settings || !settings.verificationEnabled) {
        return NextResponse.json({ error: 'Verification is currently disabled' }, { status: 400 })
      }

      await getPrisma().vendorVerificationApplication.update({
        where: { id: application.id },
        data: {
          status: 'PAYMENT_PENDING',
          paymentAmount: settings.verificationFee,
        }
      })

      return NextResponse.json({ 
        application,
        amount: settings.verificationFee,
        enabled: settings.verificationEnabled 
      })
    }

    // Handle KYC submission
    if (action === 'submit_kyc') {
      await getPrisma().vendorVerificationApplication.update({
        where: { id: application.id },
        data: {
          status: 'KYC_SUBMITTED',
          kycInfo: {
            create: {
              businessName: kycInfo.businessName,
              businessType: kycInfo.businessType,
              businessRegistrationNumber: kycInfo.businessRegistrationNumber,
              tinNumber: kycInfo.tinNumber,
              fullName: kycInfo.fullName,
              phoneNumber: kycInfo.phoneNumber,
              email: kycInfo.email,
            }
          }
        }
      })

      // Add documents
      if (documents && documents.length > 0) {
        await getPrisma().verificationDocument.createMany({
          data: documents.map((doc: any) => ({
            applicationId: application.id,
            documentType: doc.type,
            documentUrl: doc.url,
            fileName: doc.name,
          }))
        })
      }

      // Create audit log
      await getPrisma().verificationAuditLog.create({
        data: {
          applicationId: application.id,
          action: 'KYC_SUBMITTED',
        }
      })

      return NextResponse.json({ application })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error creating verification application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}