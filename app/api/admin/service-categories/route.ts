import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { rateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit-log'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimitCheck = rateLimit('admin-service-categories')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [categories, total] = await Promise.all([
      getPrisma().serviceCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { services: true },
          },
        },
      }),
      getPrisma().serviceCategory.count({ where }),
    ])
    perf.markPrismaEnd(prismaPerfStart)

    const totalPages = Math.ceil(total / limit)

    const response = NextResponse.json({
      categories,
      pagination: { page, limit, total, totalPages },
    })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Admin service categories fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch service categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    const { name, slug, description, icon } = body

    if (!name || !name.trim()) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    if (!slug || !slug.trim()) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Category slug is required' }, { status: 400 })
    }

    const existingByName = await getPrisma().serviceCategory.findFirst({
      where: { name: name.trim() },
    })
    if (existingByName) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service category with this name already exists' }, { status: 409 })
    }

    const existingBySlug = await getPrisma().serviceCategory.findUnique({
      where: { slug: slug.trim().toLowerCase() },
    })
    if (existingBySlug) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service category slug already exists' }, { status: 409 })
    }

    const category = await getPrisma().serviceCategory.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description?.trim() || null,
        icon: icon || null,
      },
    })
    perf.markPrismaEnd(prismaPerfStart)

    await createAuditLog({
      userId: authCheck.userId,
      userRole: authCheck.role,
      action: 'SERVICE_CATEGORY_CREATED',
      entityType: 'SERVICE_CATEGORY',
      entityId: category.id,
      afterData: {
        name: category.name,
        slug: category.slug,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    perf.log()
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Admin service category create error:', error)
    return NextResponse.json({ error: 'Failed to create service category' }, { status: 500 })
  }
}