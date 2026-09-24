import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { id } = await params

    const influencer = await prisma.influencer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        referralCode: true,
        active: true,
        incentivePerVendor: true,
        incentivePerCustomer: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })
    }

    const [
      clicksCount,
      customerRegistrationsCount,
      vendorRegistrationsCount,
      approvedVendorsCount,
      qualifiedReferrals,
      referredCustomerIds,
    ] = await Promise.all([
      prisma.influencerClick.count({ where: { influencerId: id } }),
      prisma.influencerReferral.count({ where: { influencerId: id, refereeRole: 'CUSTOMER' } }),
      prisma.influencerReferral.count({ where: { influencerId: id, refereeRole: 'VENDOR' } }),
      prisma.influencerReferral.count({ where: { influencerId: id, qualified: true, refereeRole: 'VENDOR' } }),
      prisma.influencerReferral.findMany({
        where: { influencerId: id, qualified: true },
        select: { incentiveAmount: true, incentivePaid: true },
      }),
      prisma.influencerReferral.findMany({
        where: { influencerId: id, refereeRole: 'CUSTOMER' },
        select: { refereeId: true },
      }),
    ])

    const customerIds = referredCustomerIds.map((r: { refereeId: string }) => r.refereeId)

    const [
      ordersAggregate,
      completedOrdersAggregate,
      cancelledRefundedOrdersAggregate,
    ] = await Promise.all([
      customerIds.length > 0
        ? prisma.order.count({ where: { userId: { in: customerIds } } })
        : Promise.resolve(0),
      customerIds.length > 0
        ? prisma.order.count({
            where: {
              userId: { in: customerIds },
              status: { in: ['COMPLETED', 'DELIVERED'] },
            },
          })
        : Promise.resolve(0),
      customerIds.length > 0
        ? prisma.order.count({
            where: {
              userId: { in: customerIds },
              OR: [
                { status: 'CANCELLED' },
                { paymentStatus: 'REFUNDED' },
              ],
            },
          })
        : Promise.resolve(0),
    ])

    const eligibleIncentive = qualifiedReferrals.reduce((sum, r) => sum + (r.incentiveAmount ?? 0), 0)
    const amountPaid = qualifiedReferrals
      .filter((r) => r.incentivePaid)
      .reduce((sum, r) => sum + (r.incentiveAmount ?? 0), 0)
    const amountPending = eligibleIncentive - amountPaid

    const report = {
      influencer,
      linkClicks: clicksCount,
      customerRegistrations: customerRegistrationsCount,
      vendorRegistrations: vendorRegistrationsCount,
      approvedVendors: approvedVendorsCount,
      orders: ordersAggregate,
      completedOrders: completedOrdersAggregate,
      cancelledRefundedOrders: cancelledRefundedOrdersAggregate,
      eligibleIncentive,
      amountPaid,
      amountPending,
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Super Admin influencer report error:', error)
    return NextResponse.json({ error: 'Failed to fetch influencer report' }, { status: 500 })
  }
}
