import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// PUT reorder products within a section
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult

    const prisma = getPrisma()
    const { id } = await params
    const { orders } = await request.json()

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json({ error: 'orders array is required' }, { status: 400 })
    }

    const section = await prisma.homepageSection.findUnique({ where: { id } })
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    await prisma.$transaction(
      orders.map((item: { productId: string; displayOrder: number }) =>
        prisma.homepageSectionProduct.updateMany({
          where: { sectionId: id, productId: item.productId },
          data: { displayOrder: item.displayOrder },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering section products:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
