import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

// Get the current vendor's payouts
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if vendor has completed onboarding (store and category)
    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup to view payouts' }, { status: 403 })
    }

    // Get vendor's store
    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({
        payouts: [],
        summary: {
          totalPaid: 0,
          totalPending: 0,
          totalProcessing: 0,
        }
      })
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause - only show payouts for this vendor's store
    const where: any = { storeId: store.id }
    if (status) where.status = status

    // Get payouts
    const payouts = await getPrisma().vendorPayout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    // Get total count for pagination
    const total = await getPrisma().vendorPayout.count({ where })

    // Calculate summary
    const allPayouts = await getPrisma().vendorPayout.findMany({
      where: { storeId: store.id }
    })

    const summary = {
      totalPaid: allPayouts.filter((p: { status: string; amount: number }) => p.status === 'PAID').reduce((sum: number, p: { amount: number }) => sum + p.amount, 0),
      totalPending: allPayouts.filter((p: { status: string; amount: number }) => p.status === 'PENDING').reduce((sum: number, p: { amount: number }) => sum + p.amount, 0),
      totalProcessing: allPayouts.filter((p: { status: string; amount: number }) => p.status === 'PROCESSING').reduce((sum: number, p: { amount: number }) => sum + p.amount, 0),
    }

    return NextResponse.json({
      payouts,
      summary,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    console.error('Error fetching vendor payouts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}