import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

const prisma = getPrisma()

export const dynamic = 'force-dynamic'

// GET all categories
export async function GET(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const includeChildren = searchParams.get('includeChildren') === 'true'

    const categories = await prisma.category.findMany({
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
    console.error('Admin categories error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// POST - Create new category
export async function POST(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const body = await request.json()
    const { name, parentId } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    // Check for duplicate name (case-insensitive)
    const allCategories = await prisma.category.findMany({
      select: { name: true }
    })
    const exists = allCategories.some(cat => 
      cat.name.toLowerCase() === name.trim().toLowerCase()
    )
    if (exists) {
      return NextResponse.json({ error: 'Category with this name already exists' }, { status: 400 })
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
        name: name.trim(),
        parentId: parentId || null,
      },
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Admin categories create error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

// PUT - Update category
export async function PUT(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const body = await request.json()
    const { id, name, parentId } = body

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const category = await prisma.category.findUnique({
      where: { id },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check for duplicate name (excluding current category, case-insensitive)
    const allCategories = await prisma.category.findMany({
      select: { name: true, id: true }
    })
    const duplicate = allCategories.find(cat => 
      cat.name.toLowerCase() === name.trim().toLowerCase() && cat.id !== id
    )
    if (duplicate) {
      return NextResponse.json({ error: 'Category with this name already exists' }, { status: 400 })
    }

    // Prevent making a category its own parent
    if (parentId === id) {
      return NextResponse.json({ error: 'Category cannot be its own parent' }, { status: 400 })
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: name.trim(),
        parentId: parentId || null,
      },
    })

    return NextResponse.json({ category: updated })
  } catch (error) {
    console.error('Admin categories update error:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

// DELETE - Remove category
export async function DELETE(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

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
    if (category._count.products > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete category with products. Remove or reassign products first.' 
      }, { status: 400 })
    }

    // Check if category has children
    if (category._count.children > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete category with subcategories. Remove subcategories first.' 
      }, { status: 400 })
    }

    await prisma.category.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin categories delete error:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}