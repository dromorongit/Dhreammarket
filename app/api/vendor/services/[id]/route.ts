import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
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
    const { id } = await params
    const token = request.cookies.get('token')?.value
    if (!token) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const service = await getPrisma().service.findFirst({
      where: { id, vendorId: store.id },
      include: {
        store: {
          select: { id: true, name: true, slug: true },
        },
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: { displayOrder: 'asc' },
          select: { id: true, imageUrl: true, displayOrder: true },
        },
      },
    })
    perf.markPrismaEnd(prismaPerfStart)

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    const response = NextResponse.json({ service })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching vendor service:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const { id } = await params
    const token = request.cookies.get('token')?.value
    if (!token) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const existingService = await getPrisma().service.findFirst({
      where: { id, vendorId: store.id },
    })

    if (!existingService) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      slug,
      description,
      shortDescription,
      startingPrice,
      pricingType,
      deliveryType,
      availabilityStatus,
      thumbnail,
      gallery,
      categoryId,
      isActive,
      isFeatured,
    } = body

    if (title !== undefined && !title.trim()) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service title cannot be empty' }, { status: 400 })
    }

    if (categoryId !== undefined) {
      const category = await getPrisma().serviceCategory.findUnique({
        where: { id: categoryId },
      })
      if (!category) {
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return NextResponse.json({ error: 'Service category not found' }, { status: 404 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title.trim()
    if (slug !== undefined) updateData.slug = slug
    if (description !== undefined) updateData.description = description?.trim() || null
    if (shortDescription !== undefined) updateData.shortDescription = shortDescription?.trim() || null
    if (startingPrice !== undefined) updateData.startingPrice = parseFloat(startingPrice)
    if (pricingType !== undefined) updateData.pricingType = pricingType
    if (deliveryType !== undefined) updateData.deliveryType = deliveryType
    if (availabilityStatus !== undefined) updateData.availabilityStatus = availabilityStatus
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail
    if (gallery !== undefined) updateData.gallery = gallery
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (isActive !== undefined) updateData.isActive = isActive
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured

    const service = await getPrisma().service.update({
      where: { id },
      data: updateData,
      include: {
        store: {
          select: { id: true, name: true, slug: true },
        },
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    })
    perf.markPrismaEnd(prismaPerfStart)

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'SERVICE_UPDATED',
      entityType: 'SERVICE',
      entityId: service.id,
      afterData: {
        title: service.title,
        startingPrice: service.startingPrice,
        isActive: service.isActive,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    perf.log()
    return NextResponse.json({ service })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error updating service:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const { id } = await params
    const token = request.cookies.get('token')?.value
    if (!token) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const existingService = await getPrisma().service.findFirst({
      where: { id, vendorId: store.id },
    })

    if (!existingService) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    await getPrisma().service.delete({
      where: { id },
    })
    perf.markPrismaEnd(prismaPerfStart)

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'SERVICE_DELETED',
      entityType: 'SERVICE',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    perf.log()
    return NextResponse.json({ success: true, message: 'Service deleted' })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error deleting service:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}