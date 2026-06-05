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

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId }
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const settings = await getPrisma().verificationSetting.findFirst()
    if (!settings || !settings.verificationEnabled) {
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
          status: 'PAYMENT_PENDING',
          paymentAmount: settings.verificationFee,
        }
      })

      await getPrisma().verificationAuditLog.create({
        data: {
          applicationId: application.id,
          action: 'APPLICATION_CREATED',
        }
      })
    } else {
      await getPrisma().vendorVerificationApplication.update({
        where: { id: application.id },
        data: {
          status: 'PAYMENT_PENDING',
          paymentAmount: settings.verificationFee,
        }
      })
    }

    return NextResponse.json({
      success: true,
      application,
      amount: settings.verificationFee,
      enabled: settings.verificationEnabled
    })
  } catch (error) {
    console.error('Error creating verification application:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}