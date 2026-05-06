import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET all vendor categories
export async function GET(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const categories = await getPrisma().vendorCategory.findMany({
      orderBy: {
        name: 'asc'
      },
      include: {
        _count: {
          select: { stores: true }
        }
      }
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Admin vendor categories error:', error)
    return NextResponse.json({ error: 'Failed to fetch vendor categories' }, { status: 500 })
  }
}

// POST create vendor category
export async function POST(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { name, slug } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    if (!slug || !slug.trim()) {
      return NextResponse.json({ error: 'Category slug is required' }, { status: 400 })
    }

    // Check for duplicate name or slug
    const existingByName = await getPrisma().vendorCategory.findUnique({
      where: { name: name.trim() }
    })
    if (existingByName) {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 409 })
    }

    const existingBySlug = await getPrisma().vendorCategory.findUnique({
      where: { slug: slug.trim().toLowerCase() }
    })
    if (existingBySlug) {
      return NextResponse.json({ error: 'Category slug already exists' }, { status: 409 })
    }

    const category = await getPrisma().vendorCategory.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        isActive: true,
      }
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('Create vendor category error:', error)
    return NextResponse.json({ error: 'Failed to create vendor category' }, { status: 500 })
  }
}

// PUT update vendor category
export async function PUT(request: NextRequest) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id, name, slug, isActive } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const existingCategory = await getPrisma().vendorCategory.findUnique({
      where: { id }
    })

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check for duplicate name if updating
    if (name && name !== existingCategory.name) {
      const duplicateName = await getPrisma().vendorCategory.findUnique({
        where: { name: name.trim() }
      })
      if (duplicateName) {
        return NextResponse.json({ error: 'Category name already exists' }, { status: 409 })
      }
    }

    // Check for duplicate slug if updating
    if (slug && slug !== existingCategory.slug) {
      const duplicateSlug = await getPrisma().vendorCategory.findUnique({
        where: { slug: slug.trim().toLowerCase() }
      })
      if (duplicateSlug) {
        return NextResponse.json({ error: 'Category slug already exists' }, { status: 409 })
      }
    }

    const updatedCategory = await getPrisma().vendorCategory.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(slug && { slug: slug.trim().toLowerCase() }),
        ...(typeof isActive === 'boolean' && { isActive }),
      }
    })

    return NextResponse.json({ category: updatedCategory })
  } catch (error) {
    console.error('Update vendor category error:', error)
    return NextResponse.json({ error: 'Failed to update vendor category' }, { status: 500 })
  }
}

// DELETE vendor category
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

    const existingCategory = await getPrisma().vendorCategory.findUnique({
      where: { id }
    })

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
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

    await getPrisma().vendorCategory.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('Delete vendor category error:', error)
    return NextResponse.json({ error: 'Failed to delete vendor category' }, { status: 500 })
  }
}
