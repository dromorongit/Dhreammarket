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
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden - Vendors only' }, { status: 403 })
    }

    const application = await getPrisma().vendorVerificationApplication.findUnique({
      where: { vendorId: payload.userId },
      include: {
        kycInfo: true,
        documents: true,
auditLogs: {
           orderBy: { createdAt: 'desc' },
         },
         payments: true,
       }
    })

    if (!application) {
      return NextResponse.json({ application: null })
    }

    return NextResponse.json({ application })
  } catch (error) {
    console.error('Error fetching vendor verification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}