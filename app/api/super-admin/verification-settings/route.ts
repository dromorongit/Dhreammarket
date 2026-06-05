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

    let settings = await getPrisma().verificationSetting.findFirst()
    
    if (!settings) {
      settings = await getPrisma().verificationSetting.create({
        data: {
          verificationFee: 250.00,
          verificationEnabled: true,
          allowResubmissionAfterRejection: true,
          autoExpirePendingApplications: false,
          expiryDays: 30,
        }
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching verification settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { verificationFee, verificationEnabled, allowResubmissionAfterRejection, autoExpirePendingApplications, expiryDays } = await request.json()

    let settings = await getPrisma().verificationSetting.findFirst()
    
    if (!settings) {
      settings = await getPrisma().verificationSetting.create({
        data: {
          verificationFee: verificationFee ?? 250.00,
          verificationEnabled: verificationEnabled ?? true,
          allowResubmissionAfterRejection: allowResubmissionAfterRejection ?? true,
          autoExpirePendingApplications: autoExpirePendingApplications ?? false,
          expiryDays: expiryDays ?? 30,
        }
      })
    } else {
      settings = await getPrisma().verificationSetting.update({
        where: { id: settings.id },
        data: {
          verificationFee: verificationFee ?? settings.verificationFee,
          verificationEnabled: verificationEnabled ?? settings.verificationEnabled,
          allowResubmissionAfterRejection: allowResubmissionAfterRejection ?? settings.allowResubmissionAfterRejection,
          autoExpirePendingApplications: autoExpirePendingApplications ?? settings.autoExpirePendingApplications,
          expiryDays: expiryDays ?? settings.expiryDays,
        }
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error updating verification settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}