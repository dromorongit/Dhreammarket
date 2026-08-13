import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export const dynamic = 'force-dynamic'

// GET single brand
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { id } = await params

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            images: true,
            store: { select: { id: true, name: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { products: true } },
      },
    })

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    return NextResponse.json({ brand })
  } catch (error) {
    console.error('Super Admin get brand error:', error)
    return NextResponse.json({ error: 'Failed to fetch brand' }, { status: 500 })
  }
}

// PUT update brand
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { id } = await params
    const body = await request.json()
    const { name, slug, logo, description, isActive, displayOrder } = body

    const existing = await prisma.brand.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    const nextSlug = slug?.trim()
      ? slug.trim().toLowerCase()
      : name?.trim()
        ? generateSlug(name.trim())
        : existing.slug

    if (nextSlug !== existing.slug) {
      const slugTaken = await prisma.brand.findUnique({ where: { slug: nextSlug } })
      if (slugTaken) {
        return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
      }
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        name: name?.trim() ?? existing.name,
        slug: nextSlug,
        logo: logo !== undefined ? logo : existing.logo,
        description: description !== undefined ? description?.trim() || null : existing.description,
        isActive: isActive ?? existing.isActive,
        displayOrder: displayOrder ?? existing.displayOrder,
      },
    })

    return NextResponse.json({ brand })
  } catch (error) {
    console.error('Super Admin update brand error:', error)
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 })
  }
}

// DELETE brand (does not delete products)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { id } = await params

    const existing = await prisma.brand.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    await prisma.product.updateMany({
      where: { brandId: id },
      data: { brandId: null },
    })

    await prisma.brand.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Super Admin delete brand error:', error)
    return NextResponse.json({ error: 'Failed to delete brand' }, { status: 500 })
  }
}
