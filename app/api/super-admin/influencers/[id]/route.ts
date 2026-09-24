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

    return NextResponse.json({ influencer })
  } catch (error) {
    console.error('Super Admin get influencer error:', error)
    return NextResponse.json({ error: 'Failed to fetch influencer' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { id } = await params
    const body = await request.json()
    const { name, email, phone, active, incentivePerVendor, incentivePerCustomer } = body

    const existing = await prisma.influencer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (typeof name === 'string' && name.trim()) {
      data.name = name.trim()
    }
    if (email !== undefined) {
      data.email =
        typeof email === 'string' && email.trim() ? email.trim() : null
    }
    if (phone !== undefined) {
      data.phone =
        typeof phone === 'string' && phone.trim() ? phone.trim() : null
    }
    if (typeof active === 'boolean') {
      data.active = active
    }
    if (typeof incentivePerVendor === 'number' || incentivePerVendor === null) {
      data.incentivePerVendor = incentivePerVendor
    }
    if (typeof incentivePerCustomer === 'number' || incentivePerCustomer === null) {
      data.incentivePerCustomer = incentivePerCustomer
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 })
    }

    const influencer = await prisma.influencer.update({
      where: { id },
      data,
    })

    return NextResponse.json({ influencer })
  } catch (error: unknown) {
    console.error('Super Admin update influencer error:', error)
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email or phone already in use by another influencer' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to update influencer' }, { status: 500 })
  }
}
