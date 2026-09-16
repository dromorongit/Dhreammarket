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

    const officer = await prisma.marketingOfficer.findUnique({
      where: { id },
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

    if (!officer) {
      return NextResponse.json({ error: 'Marketing officer not found' }, { status: 404 })
    }

    return NextResponse.json({ officer })
  } catch (error) {
    console.error('Super Admin get marketing officer error:', error)
    return NextResponse.json({ error: 'Failed to fetch marketing officer' }, { status: 500 })
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
    const { name, phone, email, active } = body

    const existing = await prisma.marketingOfficer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Marketing officer not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (typeof name === 'string' && name.trim()) {
      data.name = name.trim()
    }
    if (phone !== undefined) {
      data.phone = typeof phone === 'string' && phone.trim() ? phone.trim() : null
    }
    if (email !== undefined) {
      data.email = typeof email === 'string' && email.trim() ? email.trim() : null
    }
    if (typeof active === 'boolean') {
      data.active = active
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 })
    }

    const officer = await prisma.marketingOfficer.update({
      where: { id },
      data,
    })

    return NextResponse.json({ officer })
  } catch (error: unknown) {
    console.error('Super Admin update marketing officer error:', error)
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email or phone already in use by another officer' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to update marketing officer' }, { status: 500 })
  }
}
