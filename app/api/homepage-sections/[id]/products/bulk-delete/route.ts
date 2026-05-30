import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// POST bulk remove products from section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult

    const prisma = getPrisma()
    const { id } = await params
    const { productIds } = await request.json()

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'productIds array is required' }, { status: 400 })
    }

    await prisma.homepageSectionProduct.deleteMany({
      where: {
        sectionId: id,
        productId: { in: productIds },
      },
    })

    return NextResponse.json({ success: true, removed: productIds.length })
  } catch (error) {
    console.error('Error bulk removing section products:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
