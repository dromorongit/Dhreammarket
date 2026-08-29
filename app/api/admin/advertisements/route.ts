import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { rateLimit } from '@/lib/rate-limit'

const prisma = getPrisma()

export const dynamic = 'force-dynamic'

const ALLOWED_SLOTS = [
  'after-quick-links',
  'after-official-stores',
  'after-sponsored',
  'before-service-showcase',
  'homepage-bottom',
] as const

const SLOT_LABELS: Record<string, string> = {
  'after-quick-links': 'After Quick Links',
  'after-official-stores': 'After Official Stores',
  'after-sponsored': 'After Sponsored',
  'before-service-showcase': 'Before Service Showcase',
  'homepage-bottom': 'Homepage Bottom',
}

function validateSlot(slot: unknown): string | null {
  if (typeof slot !== 'string' || !ALLOWED_SLOTS.includes(slot as any)) {
    return 'Invalid slot. Must be one of the 5 allowed banner positions.'
  }
  return null
}

function validateDates(startDate: unknown, endDate: unknown): string | null {
  if (!startDate || !endDate) return null
  const start = new Date(startDate as string)
  const end = new Date(endDate as string)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid date format.'
  }
  if (start >= end) {
    return 'Start date must be before end date.'
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const slot = searchParams.get('slot')
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (slot) {
      const error = validateSlot(slot)
      if (error) {
        return NextResponse.json({ error }, { status: 400 })
      }
      where.slot = slot
    }
    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    const ads = await prisma.advertisement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: {
          select: { id: true, email: true, role: true },
        },
        product: {
          select: { id: true, name: true, slug: true, price: true },
        },
      },
    })

    return NextResponse.json({
      advertisements: ads.map((ad) => ({
        ...ad,
        slotLabel: SLOT_LABELS[ad.slot] || ad.slot,
      })),
    })
  } catch (error) {
    console.error('Admin advertisements list error:', error)
    return NextResponse.json({ error: 'Failed to fetch advertisements' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('admin-advertisements')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const body = await request.json()
    const { slot, title, imageUrl, linkUrl, vendorId, productId, startDate, endDate, isActive } = body

    const slotError = validateSlot(slot)
    if (slotError) {
      return NextResponse.json({ error: slotError }, { status: 400 })
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 })
    }

    if (!linkUrl || typeof linkUrl !== 'string' || linkUrl.trim().length === 0) {
      return NextResponse.json({ error: 'Link URL is required' }, { status: 400 })
    }

    const dateError = validateDates(startDate, endDate)
    if (dateError) {
      return NextResponse.json({ error: dateError }, { status: 400 })
    }

    const createData: Record<string, unknown> = {
      slot: slot as string,
      title: title.trim(),
      imageUrl: imageUrl.trim(),
      linkUrl: linkUrl.trim(),
      vendorId: vendorId || null,
      productId: productId || null,
      isActive: isActive ?? true,
      createdBy: authCheck.userId,
    }
    if (startDate) createData.startDate = new Date(startDate as string)
    if (endDate) createData.endDate = new Date(endDate as string)

    const ad = await prisma.advertisement.create({
      data: createData as any,
      include: {
        vendor: {
          select: { id: true, email: true, role: true },
        },
        product: {
          select: { id: true, name: true, slug: true, price: true },
        },
      },
    })

    return NextResponse.json({
      advertisement: {
        ...ad,
        slotLabel: SLOT_LABELS[ad.slot] || ad.slot,
      },
    })
  } catch (error) {
    console.error('Admin advertisements create error:', error)
    return NextResponse.json({ error: 'Failed to create advertisement' }, { status: 500 })
  }
}
