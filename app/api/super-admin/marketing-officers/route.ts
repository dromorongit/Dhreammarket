import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()

    const officers = await prisma.marketingOfficer.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        referralCode: true,
        active: true,
        createdAt: true,
      },
    })

    const officerIds = officers.map((officer) => officer.id)

    const [referralStats, unpaidStats] = await Promise.all([
      prisma.vendorReferral.groupBy({
        by: ['marketingOfficerId'],
        where: {
          marketingOfficerId: { in: officerIds },
        },
        _count: { _all: true },
      }),
      prisma.vendorReferral.groupBy({
        by: ['marketingOfficerId'],
        where: {
          marketingOfficerId: { in: officerIds },
          paid: false,
        },
        _sum: { amountOwed: true },
      }),
    ])

    const statsMap = new Map<string, { referralCount: number; totalUnpaid: number }>()

    for (const stat of referralStats) {
      statsMap.set(stat.marketingOfficerId, { referralCount: stat._count._all, totalUnpaid: 0 })
    }

    for (const stat of unpaidStats) {
      const current = statsMap.get(stat.marketingOfficerId) ?? { referralCount: 0, totalUnpaid: 0 }
      current.totalUnpaid = stat._sum.amountOwed ?? 0
      statsMap.set(stat.marketingOfficerId, current)
    }

    const data = officers.map((officer) => ({
      ...officer,
      referralCount: statsMap.get(officer.id)?.referralCount ?? 0,
      totalUnpaid: statsMap.get(officer.id)?.totalUnpaid ?? 0,
    }))

    return NextResponse.json({ officers: data })
  } catch (error) {
    console.error('Super Admin marketing officers error:', error)
    return NextResponse.json({ error: 'Failed to fetch marketing officers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const body = await request.json()
    const { name, phone, email } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Officer name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const trimmedPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null
    const trimmedEmail = typeof email === 'string' && email.trim() ? email.trim() : null

    let officer = null
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      const referralCode = `MKT-${randomBytes(4).toString('hex').toUpperCase()}`
      try {
        officer = await prisma.marketingOfficer.create({
          data: {
            name: trimmedName,
            phone: trimmedPhone,
            email: trimmedEmail,
            referralCode,
            active: true,
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

    if (!officer) {
      return NextResponse.json(
        { error: 'Failed to generate unique referral code after multiple attempts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ officer }, { status: 201 })
  } catch (error: unknown) {
    console.error('Super Admin create marketing officer error:', error)
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'A marketing officer with this email or phone already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to create marketing officer' }, { status: 500 })
  }
}
