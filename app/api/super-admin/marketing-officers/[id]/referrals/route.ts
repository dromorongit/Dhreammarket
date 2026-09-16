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

    const officer = await prisma.marketingOfficer.findUnique({ where: { id } })
    if (!officer) {
      return NextResponse.json({ error: 'Marketing officer not found' }, { status: 404 })
    }

    const referrals = await prisma.vendorReferral.findMany({
      where: { marketingOfficerId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: {
          select: {
            id: true,
            email: true,
            store: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    return NextResponse.json({ referrals })
  } catch (error) {
    console.error('Super Admin marketing officer referrals error:', error)
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 })
  }
}
