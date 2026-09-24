import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()

    const influencers = await prisma.influencer.findMany({
      orderBy: { createdAt: 'desc' },
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

    const influencerIds = influencers.map((i) => i.id)

    const [clickStats, customerStats, vendorStats, qualifiedStats, paidStats] =
      await Promise.all([
        prisma.influencerClick.groupBy({
          by: ['influencerId'],
          where: { influencerId: { in: influencerIds } },
          _count: { _all: true },
        }),
        prisma.influencerReferral.groupBy({
          by: ['influencerId', 'refereeRole'],
          where: { influencerId: { in: influencerIds }, refereeRole: 'CUSTOMER' },
          _count: { _all: true },
        }),
        prisma.influencerReferral.groupBy({
          by: ['influencerId', 'refereeRole'],
          where: { influencerId: { in: influencerIds }, refereeRole: 'VENDOR' },
          _count: { _all: true },
        }),
        prisma.influencerReferral.groupBy({
          by: ['influencerId'],
          where: { influencerId: { in: influencerIds }, qualified: true },
          _count: { _all: true },
        }),
        prisma.influencerReferral.groupBy({
          by: ['influencerId'],
          where: { influencerId: { in: influencerIds }, incentivePaid: true },
          _sum: { incentiveAmount: true },
        }),
      ])

    const clicksMap = new Map<string, number>()
    for (const stat of clickStats) {
      clicksMap.set(stat.influencerId, stat._count._all)
    }

    const customerMap = new Map<string, number>()
    for (const stat of customerStats) {
      customerMap.set(stat.influencerId, stat._count._all)
    }

    const vendorMap = new Map<string, number>()
    for (const stat of vendorStats) {
      vendorMap.set(stat.influencerId, stat._count._all)
    }

    const qualifiedMap = new Map<string, number>()
    for (const stat of qualifiedStats) {
      qualifiedMap.set(stat.influencerId, stat._count._all)
    }

    const paidMap = new Map<string, number>()
    for (const stat of paidStats) {
      paidMap.set(stat.influencerId, stat._sum.incentiveAmount ?? 0)
    }

    const data = influencers.map((influencer) => {
      const eligibleIncentiveRaw =
        (influencer.incentivePerVendor ?? 0) * (qualifiedMap.get(influencer.id) ?? 0) +
        (influencer.incentivePerCustomer ?? 0) * (customerMap.get(influencer.id) ?? 0)

      const amountPaid = paidMap.get(influencer.id) ?? 0
      const amountPending = eligibleIncentiveRaw - amountPaid

      return {
        ...influencer,
        linkClicks: clicksMap.get(influencer.id) ?? 0,
        customerRegistrations: customerMap.get(influencer.id) ?? 0,
        vendorRegistrations: vendorMap.get(influencer.id) ?? 0,
        approvedVendors: qualifiedMap.get(influencer.id) ?? 0,
        eligibleIncentive: eligibleIncentiveRaw,
        amountPaid,
        amountPending,
      }
    })

    return NextResponse.json({ influencers: data })
  } catch (error) {
    console.error('Super Admin influencers error:', error)
    return NextResponse.json({ error: 'Failed to fetch influencers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const body = await request.json()
    const { name, email, phone, incentivePerVendor, incentivePerCustomer } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Influencer name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const trimmedEmail =
      typeof email === 'string' && email.trim() ? email.trim() : null
    const trimmedPhone =
      typeof phone === 'string' && phone.trim() ? phone.trim() : null
    const trimmedIncentivePerVendor =
      typeof incentivePerVendor === 'number' ? incentivePerVendor : null
    const trimmedIncentivePerCustomer =
      typeof incentivePerCustomer === 'number' ? incentivePerCustomer : null

    const baseCode = trimmedName.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (!baseCode) {
      return NextResponse.json({ error: 'Influencer name must contain at least one letter or number' }, { status: 400 })
    }

    const maxCodeLength = 20
    const truncatedBase = baseCode.length > maxCodeLength ? baseCode.slice(0, maxCodeLength) : baseCode

    let referralCode = truncatedBase
    let suffix = 2
    while (true) {
      const existing = await prisma.influencer.findUnique({
        where: { referralCode },
        select: { id: true },
      })
      if (!existing) break
      const suffixString = String(suffix)
      const candidateBase = truncatedBase.length > maxCodeLength - suffixString.length
        ? truncatedBase.slice(0, maxCodeLength - suffixString.length)
        : truncatedBase
      referralCode = `${candidateBase}${suffixString}`
      suffix++
    }

    let influencer = null
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      try {
        influencer = await prisma.influencer.create({
          data: {
            name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            referralCode,
            active: true,
            incentivePerVendor: trimmedIncentivePerVendor,
            incentivePerCustomer: trimmedIncentivePerCustomer,
          },
        })
        break
      } catch (error: unknown) {
        const prismaError = error as { code?: string }
        if (prismaError.code === 'P2002' && attempts < maxAttempts - 1) {
          attempts++
          continue
        }
        if (prismaError.code === 'P2002') {
          return NextResponse.json(
            { error: 'Failed to generate unique referral code after multiple attempts' },
            { status: 409 }
          )
        }
        throw error
      }
    }

    if (!influencer) {
      return NextResponse.json(
        { error: 'Failed to generate unique referral code after multiple attempts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ influencer }, { status: 201 })
  } catch (error: unknown) {
    console.error('Super Admin create influencer error:', error)
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'An influencer with this email or phone already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to create influencer' }, { status: 500 })
  }
}
