import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET all categories (unified - vendor categories now use the Category table)
export async function GET(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const categories = await getPrisma().category.findMany({
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        parentId: true,
        createdAt: true,
        _count: {
          select: {
            products: true,
          }
        }
      }
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Admin categories error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// POST create category (unified)
export async function POST(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { name, slug, parentId, isActive } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    if (!slug || !slug.trim()) {
      return NextResponse.json({ error: 'Category slug is required' }, { status: 400 })
    }

    // Check for duplicate name (name is not unique in Prisma, use findFirst)
    const existingByName = await getPrisma().category.findFirst({
      where: { name: name.trim() }
    })
    if (existingByName) {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 409 })
    }

    // Check for duplicate slug
    const existingBySlug = await getPrisma().category.findUnique({
      where: { slug: slug.trim().toLowerCase() }
    })
    if (existingBySlug) {
      return NextResponse.json({ error: 'Category slug already exists' }, { status: 409 })
    }

    // Validate parentId if provided
    if (parentId) {
      const parent = await getPrisma().category.findUnique({
        where: { id: parentId }
      })
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 404 })
      }
    }

    const category = await getPrisma().category.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        parentId: parentId || null,
        isActive: isActive ?? true,
      }
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}

// PUT update category (unified)
export async function PUT(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id, name, slug, parentId, isActive } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const existingCategory = await getPrisma().category.findUnique({
      where: { id }
    })

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check for duplicate name if updating (name is not unique, use findFirst)
    if (name && name !== existingCategory.name) {
      const duplicateName = await getPrisma().category.findFirst({
        where: { name: name.trim() }
      })
      if (duplicateName) {
        return NextResponse.json({ error: 'Category name already exists' }, { status: 409 })
      }
    }

    // Check for duplicate slug if updating
    if (slug && slug !== existingCategory.slug) {
      const duplicateSlug = await getPrisma().category.findUnique({
        where: { slug: slug.trim().toLowerCase() }
      })
      if (duplicateSlug) {
        return NextResponse.json({ error: 'Category slug already exists' }, { status: 409 })
      }
    }

    // Prevent self-referencing parent
    const finalParentId = parentId === existingCategory.id ? null : parentId

    // Validate parentId if provided
    if (finalParentId) {
      const parent = await getPrisma().category.findUnique({
        where: { id: finalParentId }
      })
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 404 })
      }
    }

    const updatedCategory = await getPrisma().category.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(slug && { slug: slug.trim().toLowerCase() }),
        ...(parentId !== undefined && { parentId: finalParentId }),
        ...(typeof isActive === 'boolean' && { isActive }),
      }
    })

    return NextResponse.json({ category: updatedCategory })
  } catch (error) {
    console.error('Update category error:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

// DELETE category (unified)
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

    const existingCategory = await getPrisma().category.findUnique({
      where: { id }
    })

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check if category has children
    const childCount = await getPrisma().category.count({
      where: { parentId: id }
    })

    if (childCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category. It has ${childCount} subcategory(ies). Remove subcategories first.`
        },
        { status: 409 }
      )
    }

    // Check if category is in use by any store
    const storesUsingCategory = await getPrisma().store.count({
      where: { categoryId: id }
    })

    if (storesUsingCategory > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category. It is assigned to ${storesUsingCategory} store(s). Remove assignments first.`
        },
        { status: 409 }
      )
    }

    // Check if category is in use by any product
    const productsUsingCategory = await getPrisma().product.count({
      where: { categoryId: id }
    })

    if (productsUsingCategory > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category. It is used by ${productsUsingCategory} product(s). Remove or reassign products first.`
        },
        { status: 409 }
      )
    }

    await getPrisma().category.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
