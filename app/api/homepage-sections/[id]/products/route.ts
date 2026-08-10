import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

// POST /api/homepage-sections/[id]/products - Add products to a section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireSuperAdmin()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const prisma = getPrisma()
    const { id } = await params
    const body = await request.json()
    const { products } = body

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'products array is required' },
        { status: 400 }
      )
    }

    const productIds = products.map((p: any) => p.productId).filter(Boolean)
    if (productIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid productId is required' },
        { status: 400 }
      )
    }

    // Verify section exists
    const section = await prisma.homepageSection.findUnique({
      where: { id },
    })

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    // Verify all products exist
    const productsInDb = await prisma.product.findMany({
      where: { id: { in: productIds } },
    })

    if (productsInDb.length !== productIds.length) {
      return NextResponse.json(
        { error: 'Some products were not found' },
        { status: 404 }
      )
    }

    // Create associations (skip duplicates)
    const existing = await prisma.homepageSectionProduct.findMany({
      where: { sectionId: id },
      select: { productId: true, displayOrder: true },
    })
    const existingIds = new Set(existing.map((e) => e.productId))
    const newProducts = products.filter((p: any) => p.productId && !existingIds.has(p.productId))

    if (newProducts.length > 0) {
      const maxOrder = existing.reduce((max, row) => Math.max(max, row.displayOrder), -1)
      await prisma.homepageSectionProduct.createMany({
        data: newProducts.map((p: any, index: number) => ({
          sectionId: id,
          productId: p.productId,
          displayOrder: maxOrder + 1 + index,
          dealEndsAt: p.dealEndsAt ? new Date(p.dealEndsAt) : null,
        })),
        skipDuplicates: true,
      })
    }

    const updated = await prisma.homepageSectionProduct.findMany({
      where: { sectionId: id },
      orderBy: { displayOrder: 'asc' },
      include: {
        product: {
          include: {
            images: true,
            category: true,
            store: { select: { id: true, name: true, isVerified: true, badgeTier: true } },
          },
        },
      },
    })

    return NextResponse.json({ products: updated.map((p) => p.product) })
  } catch (error) {
    console.error('Error adding products to section:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/homepage-sections/[id]/products - Update dealEndsAt for assigned products
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireSuperAdmin()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const prisma = getPrisma()
    const { id } = await params
    const body = await request.json()
    const { productId, dealEndsAt } = body

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      )
    }

    const existing = await prisma.homepageSectionProduct.findUnique({
      where: {
        sectionId_productId: {
          sectionId: id,
          productId,
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Product is not assigned to this section' },
        { status: 404 }
      )
    }

    const updated = await prisma.homepageSectionProduct.update({
      where: {
        sectionId_productId: {
          sectionId: id,
          productId,
        },
      },
      data: {
        dealEndsAt: dealEndsAt ? new Date(dealEndsAt) : null,
      },
      include: {
        product: {
          include: {
            images: true,
            category: true,
            store: { select: { id: true, name: true, isVerified: true, badgeTier: true } },
          },
        },
      },
    })

    return NextResponse.json({ product: updated.product })
  } catch (error) {
    console.error('Error updating product deal end:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/homepage-sections/[id]/products - Remove a product from a section
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireSuperAdmin()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const prisma = getPrisma()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json(
        { error: 'productId query parameter is required' },
        { status: 400 }
      )
    }

    await prisma.homepageSectionProduct.deleteMany({
      where: { sectionId: id, productId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing product from section:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
