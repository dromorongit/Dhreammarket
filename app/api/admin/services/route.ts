import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { rateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit-log'
import { generateSlug } from '@/lib/slug'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimitCheck = rateLimit('admin-services')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const categoryId = searchParams.get('categoryId')
    const vendorId = searchParams.get('vendorId')
    const isActive = searchParams.get('isActive')
    const isFeatured = searchParams.get('isFeatured')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (vendorId) {
      where.vendorId = vendorId
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    if (isFeatured !== null) {
      where.isFeatured = isFeatured === 'true'
    }

    const [services, total] = await Promise.all([
      getPrisma().service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          store: {
            select: { id: true, name: true, slug: true, isVerified: true },
          },
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
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Admin services fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return authCheck
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
      vendorId,
      isActive,
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

    if (!vendorId) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Vendor (store) is required' }, { status: 400 })
    }

    const category = await getPrisma().serviceCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service category not found' }, { status: 404 })
    }

    const store = await getPrisma().store.findUnique({
      where: { id: vendorId },
    })

    if (!store) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const finalSlug = slug || (await generateSlug({ baseText: title.trim(), target: 'Service' }))

    const service = await getPrisma().service.create({
      data: {
        vendorId,
        categoryId,
        title: title.trim(),
        slug: finalSlug,
        description: description?.trim() || null,
        shortDescription: shortDescription?.trim() || null,
        startingPrice: startingPrice !== undefined ? parseFloat(startingPrice) : 0,
        pricingType: pricingType || 'FIXED',
        deliveryType: deliveryType || 'ONLINE',
        availabilityStatus: availabilityStatus || 'AVAILABLE',
        thumbnail: thumbnail || null,
        gallery: gallery || [],
        isActive: isActive !== undefined ? isActive : true,
        isFeatured: isFeatured || false,
      },
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
      userId: authCheck.userId,
      userRole: authCheck.role,
      action: 'SERVICE_CREATED',
      entityType: 'SERVICE',
      entityId: service.id,
      afterData: {
        title: service.title,
        startingPrice: service.startingPrice,
        vendorId: service.vendorId,
        categoryId: service.categoryId,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    perf.log()
    return NextResponse.json({ service }, { status: 201 })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Admin service create error:', error)
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
  }
}