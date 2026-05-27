import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

const prisma = getPrisma()

// Generate a URL-friendly slug from a name
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

// GET all product categories
export async function GET(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const includeChildren = searchParams.get('includeChildren') === 'true'

    const categories = await prisma.productCategory.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
      include: {
        children: includeChildren,
        _count: {
          select: { products: true },
        },
      },
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Admin product categories error:', error)
    return NextResponse.json({ error: 'Failed to fetch product categories' }, { status: 500 })
  }
}

// POST - Create new product category
export async function POST(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const body = await request.json()
    const { name, parentId } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Product category name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()

    // Check for duplicate name (case-insensitive) using raw query to avoid type issues
    const allCategories = await prisma.$queryRaw<{ name: string; slug: string }[]>`
      SELECT name, slug FROM product_categories
    `
    const exists = allCategories.some((cat: { name: string; slug: string }) =>
      cat.name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (exists) {
      return NextResponse.json({ error: 'Product category with this name already exists' }, { status: 400 })
    }

    // Generate unique slug
    let slug = generateSlug(trimmedName)
    const existingSlugs = new Set(allCategories.map((c: { name: string; slug: string }) => c.slug))
    if (existingSlugs.has(slug)) {
      let counter = 1
      while (existingSlugs.has(`${slug}-${counter}`)) {
        counter++
      }
      slug = `${slug}-${counter}`
    }

    // If parentId provided, verify it exists
    if (parentId) {
      const parent = await prisma.productCategory.findUnique({
        where: { id: parentId },
      })
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 404 })
      }
    }

    const category = await prisma.productCategory.create({
      data: {
        name: trimmedName,
        slug,
        parentId: parentId || null,
        isActive: true,
      },
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Admin product categories create error:', error)
    return NextResponse.json({ error: 'Failed to create product category' }, { status: 500 })
  }
}

// PUT - Update product category
export async function PUT(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const body = await request.json()
    const { id, name, parentId } = body

    if (!id) {
      return NextResponse.json({ error: 'Product category ID is required' }, { status: 400 })
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Product category name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()

    const category = await prisma.productCategory.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, parentId: true, createdAt: true, updatedAt: true },
    })

    if (!category) {
      return NextResponse.json({ error: 'Product category not found' }, { status: 404 })
    }

    // Check for duplicate name (excluding current category, case-insensitive)
    const allCategories = await prisma.$queryRaw<{ name: string; id: string; slug: string }[]>`
      SELECT name, id, slug FROM product_categories WHERE id != ${id}
    `
    const duplicate = allCategories.find(cat =>
      cat.name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicate) {
      return NextResponse.json({ error: 'Product category with this name already exists' }, { status: 400 })
    }

    // Prevent making a category its own parent
    if (parentId === id) {
      return NextResponse.json({ error: 'Category cannot be its own parent' }, { status: 400 })
    }

    // Update slug if name changed
    const currentSlug = (category as { slug: string }).slug
    let newSlug = currentSlug
    if (trimmedName !== category.name) {
      newSlug = generateSlug(trimmedName)
      const allCats = allCategories as { name: string; id: string; slug: string }[]
      const existingSlugs = new Set(allCats.map(c => c.slug))
      if (existingSlugs.has(newSlug)) {
        let counter = 1
        while (existingSlugs.has(`${newSlug}-${counter}`)) {
          counter++
        }
        newSlug = `${newSlug}-${counter}`
      }
    }

    const updated = await prisma.productCategory.update({
      where: { id },
      data: {
        name: trimmedName,
        slug: newSlug,
        parentId: parentId || null,
      },
    })

    return NextResponse.json({ category: updated })
  } catch (error) {
    console.error('Admin product categories update error:', error)
    return NextResponse.json({ error: 'Failed to update product category' }, { status: 500 })
  }
}

// DELETE - Remove product category
export async function DELETE(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Product category ID is required' }, { status: 400 })
    }

    const category = await prisma.productCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, children: true } },
      },
    })

    if (!category) {
      return NextResponse.json({ error: 'Product category not found' }, { status: 404 })
    }

    // Check if category has products
    if (category._count.products > 0) {
      return NextResponse.json({
        error: 'Cannot delete product category with products. Remove or reassign products first.'
      }, { status: 400 })
    }

    // Check if category has children
    if (category._count.children > 0) {
      return NextResponse.json({
        error: 'Cannot delete product category with subcategories. Remove subcategories first.'
      }, { status: 400 })
    }

    await prisma.productCategory.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin product categories delete error:', error)
    return NextResponse.json({ error: 'Failed to delete product category' }, { status: 500 })
  }
}
