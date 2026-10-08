import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  const influencer = await getPrisma().influencer.findUnique({
    where: { referralCode: code },
    select: {
      active: true,
      customerSignupPoints: true,
      customerCashbackPercent: true,
      customerCashbackMaxOrders: true,
      vendorPlan: true,
      vendorPlanDurationMonths: true,
      name: true,
    },
  })

  if (!influencer || !influencer.active) {
    return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })
  }

  return NextResponse.json({
    customerSignupPoints: influencer.customerSignupPoints,
    customerCashbackPercent: influencer.customerCashbackPercent,
    customerCashbackMaxOrders: influencer.customerCashbackMaxOrders,
    vendorPlan: influencer.vendorPlan,
    vendorPlanDurationMonths: influencer.vendorPlanDurationMonths,
    name: influencer.name,
  })
}
