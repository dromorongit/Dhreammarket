import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

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

// GET all categories with product counts and status
export async function GET(request: NextRequest) {
  try {
    const authCheck = requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const includeChildren = searchParams.get('includeChildren') === 'true'
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const whereClause: Record<string, unknown> = {}
    if (!includeInactive) {
      whereClause.isActive = true
    }

    const categories = await prisma.category.findMany({
      where: whereClause,
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
    console.error('Super Admin categories error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// POST - Create new category
export async function POST(request: NextRequest) {
  try {
    const authCheck = requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const body = await request.json()
    const { name, parentId, isActive } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()

    // Check for duplicate name (case-insensitive)
    const allCategories = await prisma.$queryRaw<{ name: string; slug: string }[]>`
      SELECT name, slug FROM categories
    `
    const exists = allCategories.some((cat) =>
      cat.name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (exists) {
      return NextResponse.json({ error: 'Category with this name already exists' }, { status: 400 })
    }

    // Generate unique slug
    let slug = generateSlug(trimmedName)
    const existingSlugs = new Set(allCategories.map((c) => c.slug))
    if (existingSlugs.has(slug)) {
      let counter = 1
      while (existingSlugs.has(`${slug}-${counter}`)) {
        counter++
      }
      slug = `${slug}-${counter}`
    }

    // If parentId provided, verify it exists
    if (parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: parentId },
      })
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 404 })
      }
    }

    const category = await prisma.category.create({
      data: {
        name: trimmedName,
        slug,
        parentId: parentId || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Super Admin categories create error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

// PUT - Update category
export async function PUT(request: NextRequest) {
  try {
    const authCheck = requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const body = await request.json()
    const { id, name, parentId, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()

    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, parentId: true, isActive: true, createdAt: true, updatedAt: true },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check for duplicate name (excluding current category, case-insensitive)
    const allCategories = await prisma.$queryRaw<{ name: string; id: string; slug: string }[]>`
      SELECT name, id, slug FROM categories WHERE id != ${id}
    `
    const duplicate = allCategories.find((cat) =>
      cat.name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicate) {
      return NextResponse.json({ error: 'Category with this name already exists' }, { status: 400 })
    }

    // Prevent making a category its own parent
    if (parentId === id) {
      return NextResponse.json({ error: 'Category cannot be its own parent' }, { status: 400 })
    }

    // If parentId changed, verify new parent exists and is not a descendant
    if (parentId && parentId !== category.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: parentId },
      })
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 404 })
      }

      // Prevent circular hierarchy: check if the new parent is a descendant of this category
      const checkDescendant = async (parentIdToCheck: string, ancestorId: string): Promise<boolean> => {
        const children = await prisma.category.findMany({
          where: { parentId: parentIdToCheck },
          select: { id: true },
        })
        for (const child of children) {
          if (child.id === ancestorId) return true
          if (await checkDescendant(child.id, ancestorId)) return true
        }
        return false
      }

      const isDescendant = await checkDescendant(parentId, id)
      if (isDescendant) {
        return NextResponse.json({ error: 'Cannot set a descendant category as parent' }, { status: 400 })
      }
    }

    // Update slug if name changed
    const currentSlug = (category as { slug: string }).slug
    let newSlug = currentSlug
    if (trimmedName !== category.name) {
      newSlug = generateSlug(trimmedName)
      const allCats = allCategories as { name: string; id: string; slug: string }[]
      const existingSlugs = new Set(allCats.map((c) => c.slug))
      if (existingSlugs.has(newSlug)) {
        let counter = 1
        while (existingSlugs.has(`${newSlug}-${counter}`)) {
          counter++
        }
        newSlug = `${newSlug}-${counter}`
      }
    }

    const updateData: Record<string, unknown> = {
      name: trimmedName,
      slug: newSlug,
      parentId: parentId || null,
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive
    }

    const updated = await prisma.category.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ category: updated })
  } catch (error) {
    console.error('Super Admin categories update error:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

// DELETE - Remove category
export async function DELETE(request: NextRequest) {
  try {
    const authCheck = requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const force = searchParams.get('force') === 'true'

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, children: true } },
      },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check if category has products
    if (category._count.products > 0 && !force) {
      return NextResponse.json({
        error: 'Cannot delete category with products. Remove or reassign products first, or use force delete.',
        hasProducts: true,
        productCount: category._count.products,
      }, { status: 400 })
    }

    // Check if category has children
    if (category._count.children > 0 && !force) {
      return NextResponse.json({
        error: 'Cannot delete category with subcategories. Remove subcategories first, or use force delete.',
        hasChildren: true,
        childCount: category._count.children,
      }, { status: 400 })
    }

    // If force delete, remove product associations via raw SQL since categoryId is non-nullable
    if (force && category._count.products > 0) {
      await prisma.$executeRaw`
        DELETE FROM products WHERE categoryId = ${id}
      `
    }

    await prisma.category.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Super Admin categories delete error:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
