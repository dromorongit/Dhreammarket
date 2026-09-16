import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { id } = await params

    const referral = await prisma.vendorReferral.findUnique({ where: { id } })
    if (!referral) {
      return NextResponse.json({ error: 'Vendor referral not found' }, { status: 404 })
    }

    if (referral.paid) {
      return NextResponse.json(
        { error: 'This referral has already been marked as paid' },
        { status: 409 }
      )
    }

    const updated = await prisma.vendorReferral.update({
      where: { id },
      data: { paid: true, paidAt: new Date() },
    })

    return NextResponse.json({ referral: updated })
  } catch (error) {
    console.error('Super Admin mark vendor referral paid error:', error)
    return NextResponse.json({ error: 'Failed to mark referral as paid' }, { status: 500 })
  }
}
