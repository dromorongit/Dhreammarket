import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'
import { PerformanceLogger } from '@/lib/performance'

interface RouteParams {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: RouteParams) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return authCheck
    }

    const { id } = await params
    const category = await getPrisma().serviceCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { services: true },
        },
      },
    })
    perf.markPrismaEnd(prismaPerfStart)

    if (!category) {
      return NextResponse.json({ error: 'Service category not found' }, { status: 404 })
    }

    const response = NextResponse.json({ category })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Admin service category get error:', error)
    return NextResponse.json({ error: 'Failed to fetch service category' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return authCheck
    }

    const { id } = await params
    const body = await request.json()

    const existingCategory = await getPrisma().serviceCategory.findUnique({
      where: { id },
    })

    if (!existingCategory) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service category not found' }, { status: 404 })
    }

    const { name, slug, description, icon, banner, displayOrder, isActive, isFeatured, metaTitle, metaDescription } = body

    if (name !== undefined && !name.trim()) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Category name cannot be empty' }, { status: 400 })
    }

    if (name !== undefined && name !== existingCategory.name) {
      const duplicate = await getPrisma().serviceCategory.findFirst({
        where: { name: name.trim(), id: { not: id } },
      })
      if (duplicate) {
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return NextResponse.json({ error: 'Service category with this name already exists' }, { status: 409 })
      }
    }

    if (slug !== undefined && slug !== existingCategory.slug) {
      const duplicate = await getPrisma().serviceCategory.findUnique({
        where: { slug: slug.trim().toLowerCase() },
      })
      if (duplicate) {
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return NextResponse.json({ error: 'Service category slug already exists' }, { status: 409 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (slug !== undefined) updateData.slug = slug.trim().toLowerCase()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (icon !== undefined) updateData.icon = icon
    if (banner !== undefined) updateData.banner = banner || null
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder
    if (isActive !== undefined) updateData.isActive = isActive
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured
    if (metaTitle !== undefined) updateData.metaTitle = metaTitle || null
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription || null

    const category = await getPrisma().serviceCategory.update({
      where: { id },
      data: updateData,
    })
    perf.markPrismaEnd(prismaPerfStart)

    await createAuditLog({
      userId: authCheck.userId,
      userRole: authCheck.role,
      action: 'SERVICE_CATEGORY_UPDATED',
      entityType: 'SERVICE_CATEGORY',
      entityId: category.id,
      afterData: {
        name: category.name,
        slug: category.slug,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    perf.log()
    return NextResponse.json({ category })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Admin service category update error:', error)
    return NextResponse.json({ error: 'Failed to update service category' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return authCheck
    }

    const { id } = await params
    const existingCategory = await getPrisma().serviceCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { services: true } },
      },
    })

    if (!existingCategory) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service category not found' }, { status: 404 })
    }

    if (existingCategory._count.services > 0) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({
        error: `Cannot delete service category. It is assigned to ${existingCategory._count.services} service(s). Remove assignments first.`,
      }, { status: 409 })
    }

    await getPrisma().serviceCategory.delete({
      where: { id },
    })
    perf.markPrismaEnd(prismaPerfStart)

    await createAuditLog({
      userId: authCheck.userId,
      userRole: authCheck.role,
      action: 'SERVICE_CATEGORY_DELETED',
      entityType: 'SERVICE_CATEGORY',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    perf.log()
    return NextResponse.json({ success: true, message: 'Service category deleted' })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Admin service category delete error:', error)
    return NextResponse.json({ error: 'Failed to delete service category' }, { status: 500 })
  }
}