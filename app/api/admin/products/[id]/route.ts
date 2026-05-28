import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
const prisma = getPrisma()
import { requireAdmin } from '@/lib/adminAuth'

interface RouteParams {
  params: Promise<{ id: string }>
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