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

// GET all brands
export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: Record<string, unknown> = {}
    if (!includeInactive) where.isActive = true
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ]
    }

    const brands = await prisma.brand.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: true } },
      },
    })

    return NextResponse.json({ brands })
  } catch (error) {
    console.error('Super Admin brands error:', error)
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 })
  }
}

// POST create brand
export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const body = await request.json()
    const { name, slug, logo, description, isActive, displayOrder } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const brandSlug = (slug?.trim() || generateSlug(trimmedName)).toLowerCase()

    const existing = await prisma.brand.findFirst({
      where: {
        OR: [{ name: { equals: trimmedName, mode: 'insensitive' } }, { slug: brandSlug }],
      },
    })
    if (existing) {
      return NextResponse.json({ error: 'Brand with this name or slug already exists' }, { status: 409 })
    }

    const brand = await prisma.brand.create({
      data: {
        name: trimmedName,
        slug: brandSlug,
        logo: logo || null,
        description: description?.trim() || null,
        isActive: isActive ?? true,
        displayOrder: displayOrder ?? 0,
      },
    })

    return NextResponse.json({ brand }, { status: 201 })
  } catch (error) {
    console.error('Super Admin create brand error:', error)
    return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 })
  }
}
