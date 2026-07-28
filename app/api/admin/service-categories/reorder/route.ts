import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return authCheck
    }

    const body = await request.json()
    const orders: Record<string, number> = body

    if (!orders || typeof orders !== 'object') {
      return NextResponse.json({ error: 'Invalid orders payload' }, { status: 400 })
    }

    const categoryIds = Object.keys(orders)
    if (categoryIds.length === 0) {
      return NextResponse.json({ error: 'No categories provided' }, { status: 400 })
    }

    const existingCategories = await getPrisma().serviceCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    })

    if (existingCategories.length !== categoryIds.length) {
      return NextResponse.json({ error: 'One or more categories not found' }, { status: 404 })
    }

    await getPrisma().$transaction(
      categoryIds.map(id =>
        getPrisma().serviceCategory.update({
          where: { id },
          data: { displayOrder: orders[id] },
        })
      )
    )

    perf.markPrismaEnd(prismaPerfStart)

    await createAuditLog({
      userId: authCheck.userId,
      userRole: authCheck.role,
      action: 'SERVICE_CATEGORIES_REORDERED',
      entityType: 'SERVICE_CATEGORY',
      entityId: categoryIds[0],
      afterData: { orders },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    perf.log()
    return NextResponse.json({ success: true })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Service categories reorder error:', error)
    return NextResponse.json({ error: 'Failed to reorder service categories' }, { status: 500 })
  }
}
