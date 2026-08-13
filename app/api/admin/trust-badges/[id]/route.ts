import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    await getPrisma().vendorTrustBadge.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting trust badge:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
