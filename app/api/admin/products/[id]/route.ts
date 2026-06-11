import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { allocateForProductStock } from '@/lib/stock-allocation-engine'

interface RouteParams {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

// GET product by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id } = await params
    const prisma = getPrisma()

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        store: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        category: true,
        images: true,
        productReviews: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        _count: {
          select: { productReviews: true, orderItems: true, cartItems: true },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Admin product get error:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

// DELETE - Remove/delete product (moderation)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id } = await params
    const prisma = getPrisma()

    const product = await prisma.product.findUnique({
      where: { id },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Delete the product and all related data (cascade will handle related records)
    await prisma.product.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Product removed' })
  } catch (error) {
    console.error('Admin product delete error:', error)
    return NextResponse.json({ error: 'Failed to remove product' }, { status: 500 })
  }
}

// PATCH - Update product (including reserved stock correction)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id } = await params
    const prisma = getPrisma()
    const body = await request.json()

    const product = await prisma.product.findUnique({
      where: { id },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const updateData: any = {}
    let reservedQty = product.reservedQuantity
    const previousStock = product.stock

    if (body.reservedQuantity !== undefined) {
      const reserved = Math.max(0, body.reservedQuantity)
      if (reserved > product.stock) {
        return NextResponse.json({ 
          error: `Reserved quantity cannot exceed total stock (${product.stock})` 
        }, { status: 400 })
      }
      updateData.reservedQuantity = reserved
      reservedQty = reserved
    }

    if (body.stock !== undefined) {
      updateData.stock = body.stock
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
    })

    // Trigger allocation engine if stock increased
    if (body.stock !== undefined && body.stock > previousStock) {
      const allocationResult = await allocateForProductStock(id, previousStock, body.stock, 'admin')
      if (allocationResult.success && allocationResult.allocatedOrders.length > 0) {
        console.log(`[Stock Allocation] Allocated ${allocationResult.allocatedOrders.length} orders for product ${product.name}`)
      }
    }

    console.log(`[Admin Stock Adjustment] Product ${product.name} reservedQuantity adjusted to ${reservedQty}`)

    return NextResponse.json({
      success: true,
      product: {
        id: updatedProduct.id,
        stock: updatedProduct.stock,
        reservedQuantity: updatedProduct.reservedQuantity,
        availableQuantity: updatedProduct.stock - updatedProduct.reservedQuantity,
      },
    })
  } catch (error) {
    console.error('Admin product update error:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}