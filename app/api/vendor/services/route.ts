import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { createAuditLog } from '@/lib/audit-log'
import { generateSlug } from '@/lib/slug'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const token = request.cookies.get('token')?.value
    let payload = null

    if (token) {
      payload = await verifyToken(token)
    }

    const url = new URL(request.url)
    const sortBy = url.searchParams.get('sortBy') || 'createdAt'
    const sortOrder = url.searchParams.get('sortOrder') || 'desc'
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '24', 10)
    const skip = (page - 1) * limit
    const search = url.searchParams.get('search') || ''
    const categoryId = url.searchParams.get('categoryId') || ''
    const status = url.searchParams.get('status') || ''
    const availabilityStatus = url.searchParams.get('availabilityStatus') || ''
    const isActive = url.searchParams.get('isActive')

    if (payload && payload.role === 'VENDOR') {
      const store = await getPrisma().store.findUnique({
        where: { userId: payload.userId },
      })

      if (!store) {
        const response = NextResponse.json({ services: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } })
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        response.headers.set('Pragma', 'no-cache')
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return response
      }

      const where: Record<string, unknown> = { vendorId: store.id }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      }

      if (categoryId) {
        where.categoryId = categoryId
      }

      if (status) {
        where.status = status as any
      }

      if (availabilityStatus) {
        where.availabilityStatus = availabilityStatus as any
      }

      if (isActive !== null) {
        where.isActive = isActive === 'true'
      }

      const [services, total] = await Promise.all([
        getPrisma().service.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [sortBy]: sortOrder,
          },
          include: {
            category: {
              select: { id: true, name: true, slug: true },
            },
            images: {
              orderBy: { displayOrder: 'asc' },
              select: { id: true, imageUrl: true, displayOrder: true },
            },
          },
        }),
        getPrisma().service.count({ where }),
      ])
      perf.markPrismaEnd(prismaPerfStart)

      const totalPages = Math.ceil(total / limit)

      const response = NextResponse.json({
        services,
        pagination: { page, limit, total, totalPages },
      })
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      response.headers.set('Pragma', 'no-cache')
      perf.log()
      return response
    }

    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching vendor services:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
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

    if (!store.canOfferServices) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service offering is not enabled for this store' }, { status: 403 })
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
      status,
      requirementsFromCustomer,
      estimatedDeliveryTime,
      tags,
      isFeatured,
    } = body

    if (!title || !title.trim()) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service title is required' }, { status: 400 })
    }

    if (!categoryId) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service category is required' }, { status: 400 })
    }

    const category = await getPrisma().serviceCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service category not found' }, { status: 404 })
    }

    const finalSlug = slug || (await generateSlug({ baseText: title.trim(), target: 'Service' }))

    const service = await getPrisma().service.create({
      data: {
        vendorId: store.id,
        categoryId,
        title: title.trim(),
        slug: finalSlug,
        description: description?.trim() || null,
        shortDescription: shortDescription?.trim() || null,
        startingPrice: startingPrice !== undefined ? parseFloat(startingPrice) : 0,
        pricingType: pricingType || 'FIXED_PRICE',
        deliveryType: deliveryType || 'ONLINE',
        availabilityStatus: availabilityStatus || 'AVAILABLE',
        status: status || 'DRAFT',
        thumbnail: thumbnail || null,
        gallery: gallery || [],
        requirementsFromCustomer: requirementsFromCustomer?.trim() || null,
        estimatedDeliveryTime: estimatedDeliveryTime?.trim() || null,
        tags: Array.isArray(tags) ? tags : [],
        isFeatured: isFeatured || false,
      },
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

    if (thumbnail) {
      await getPrisma().serviceImage.create({
        data: {
          serviceId: service.id,
          imageUrl: thumbnail,
          displayOrder: 0,
        },
      })
    }

    if (Array.isArray(gallery) && gallery.length > 0) {
      await getPrisma().serviceImage.createMany({
        data: gallery.map((url, index) => ({
          serviceId: service.id,
          imageUrl: url,
          displayOrder: thumbnail ? index + 1 : index,
        })),
      })
    }

    const serviceWithImages = await getPrisma().service.findUnique({
      where: { id: service.id },
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

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'SERVICE_CREATED',
      entityType: 'SERVICE',
      entityId: service.id,
      afterData: {
        title: service.title,
        startingPrice: service.startingPrice,
        vendorId: service.vendorId,
        categoryId: service.categoryId,
        status: service.status,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    perf.log()
    return NextResponse.json({ service: serviceWithImages }, { status: 201 })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error creating service:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}
