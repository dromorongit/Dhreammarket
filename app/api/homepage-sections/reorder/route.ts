import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

// PUT /api/homepage-sections/reorder - Reorder sections
export async function PUT(request: NextRequest) {
  try {
    const authResult = requireSuperAdmin()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const prisma = getPrisma()
    const { orders } = await request.json()

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json(
        { error: 'orders array is required' },
        { status: 400 }
      )
    }

    // Update displayOrder for each section
    const updates = orders.map((item: { id: string; displayOrder: number }) =>
      prisma.homepageSection.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      })
    )

    await Promise.all(updates)

    const sections = await prisma.homepageSection.findMany({
      orderBy: { displayOrder: 'asc' },
    })

    return NextResponse.json({ sections })
  } catch (error) {
    console.error('Error reordering sections:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
