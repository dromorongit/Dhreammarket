import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { ensureDefaultHomepageSections } from '@/lib/homepage-default-sections'

// GET /api/homepage-sections - List all homepage sections (SUPER_ADMIN only)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const prisma = getPrisma()
    await ensureDefaultHomepageSections(prisma)

    const sections = await prisma.homepageSection.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: {
            products: true,
            vendors: true,
          },
        },
      },
    })

    return NextResponse.json({ sections })
  } catch (error) {
    console.error('Error fetching homepage sections:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/homepage-sections - Create a new homepage section (SUPER_ADMIN only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const prisma = getPrisma()
    const { name, slug, type, subtitle, isEnabled, displayOrder } = await request.json()

    if (!name || !slug || !type) {
      return NextResponse.json(
        { error: 'Name, slug, and type are required' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existing = await prisma.homepageSection.findUnique({
      where: { slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A section with this slug already exists' },
        { status: 409 }
      )
    }

    const section = await prisma.homepageSection.create({
      data: {
        name,
        slug,
        type,
        subtitle: subtitle || null,
        isEnabled: isEnabled ?? true,
        displayOrder: displayOrder ?? 0,
      },
    })

    return NextResponse.json({ section }, { status: 201 })
  } catch (error) {
    console.error('Error creating homepage section:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
