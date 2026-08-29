import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { rateLimit } from '@/lib/rate-limit'

const prisma = getPrisma()

interface RouteParams {
  params: { id: string }
}

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

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id } = await params
    const ad = await prisma.advertisement.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { id: true, email: true, role: true },
        },
        product: {
          select: { id: true, name: true, slug: true, price: true },
        },
      },
    })

    if (!ad) {
      return NextResponse.json({ error: 'Advertisement not found' }, { status: 404 })
    }

    return NextResponse.json({
      advertisement: {
        ...ad,
        slotLabel: SLOT_LABELS[ad.slot] || ad.slot,
      },
    })
  } catch (error) {
    console.error('Admin advertisement get error:', error)
    return NextResponse.json({ error: 'Failed to fetch advertisement' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const rateLimitCheck = rateLimit('admin-advertisements')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id } = await params
    const body = await request.json()

    const existingAd = await prisma.advertisement.findUnique({
      where: { id },
    })

    if (!existingAd) {
      return NextResponse.json({ error: 'Advertisement not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.slot !== undefined) {
      const slotError = validateSlot(body.slot)
      if (slotError) {
        return NextResponse.json({ error: slotError }, { status: 400 })
      }
      updateData.slot = body.slot
    }

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      updateData.title = body.title.trim()
    }

    if (body.imageUrl !== undefined) {
      if (typeof body.imageUrl !== 'string' || body.imageUrl.trim().length === 0) {
        return NextResponse.json({ error: 'Image URL cannot be empty' }, { status: 400 })
      }
      updateData.imageUrl = body.imageUrl.trim()
    }

    if (body.linkUrl !== undefined) {
      if (typeof body.linkUrl !== 'string' || body.linkUrl.trim().length === 0) {
        return NextResponse.json({ error: 'Link URL cannot be empty' }, { status: 400 })
      }
      updateData.linkUrl = body.linkUrl.trim()
    }

    if (body.vendorId !== undefined) {
      updateData.vendorId = body.vendorId || null
    }

    if (body.productId !== undefined) {
      updateData.productId = body.productId || null
    }

    if (body.startDate !== undefined || body.endDate !== undefined) {
      const newStart = body.startDate !== undefined ? body.startDate : existingAd.startDate.toISOString()
      const newEnd = body.endDate !== undefined ? body.endDate : existingAd.endDate.toISOString()
      const dateError = validateDates(newStart, newEnd)
      if (dateError) {
        return NextResponse.json({ error: dateError }, { status: 400 })
      }
      if (body.startDate !== undefined) {
        updateData.startDate = new Date(newStart)
      }
      if (body.endDate !== undefined) {
        updateData.endDate = new Date(newEnd)
      }
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive
    }

    const updatedAd = await prisma.advertisement.update({
      where: { id },
      data: updateData,
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
        ...updatedAd,
        slotLabel: SLOT_LABELS[updatedAd.slot] || updatedAd.slot,
      },
    })
  } catch (error) {
    console.error('Admin advertisement update error:', error)
    return NextResponse.json({ error: 'Failed to update advertisement' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const rateLimitCheck = rateLimit('admin-advertisements')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id } = await params
    const existingAd = await prisma.advertisement.findUnique({
      where: { id },
    })

    if (!existingAd) {
      return NextResponse.json({ error: 'Advertisement not found' }, { status: 404 })
    }

    await prisma.advertisement.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Advertisement deleted' })
  } catch (error) {
    console.error('Admin advertisement delete error:', error)
    return NextResponse.json({ error: 'Failed to delete advertisement' }, { status: 500 })
  }
}
