import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await getPrisma().vendorTrustBadge.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting trust badge:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
