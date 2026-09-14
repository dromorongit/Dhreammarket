import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id: vendorUserId } = await params

    const store = await getPrisma().store.findUnique({
      where: { userId: vendorUserId },
    })

    if (!store) {
      return NextResponse.json({ payoutMethod: null, hasPayoutMethod: false })
    }

    const defaultMethod = await getPrisma().vendorPayoutMethod.findFirst({
      where: { vendorId: vendorUserId, storeId: store.id, isDefault: true, isActive: true },
    })

    if (!defaultMethod) {
      return NextResponse.json({ payoutMethod: null, hasPayoutMethod: false })
    }

    const maskedDetails: Record<string, any> = defaultMethod.details as Record<string, any>
    if (maskedDetails.momoNumber) {
      const digits = String(maskedDetails.momoNumber).replace(/\s/g, '')
      maskedDetails.momoNumber = digits.length > 4 ? `••••${digits.slice(-4)}` : digits
    }
    if (maskedDetails.accountNumber) {
      const digits = String(maskedDetails.accountNumber).replace(/\s/g, '')
      maskedDetails.accountNumber = digits.length > 4 ? `••••${digits.slice(-4)}` : digits
    }

    return NextResponse.json({
      payoutMethod: {
        id: defaultMethod.id,
        type: defaultMethod.type,
        details: maskedDetails,
        isDefault: defaultMethod.isDefault,
      },
      hasPayoutMethod: true,
    })
  } catch (error) {
    console.error('Error fetching vendor payout method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
