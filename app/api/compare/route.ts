import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const product = await getPrisma().product.findUnique({
      where: { id: productId },
      include: {
        images: true,
        store: { select: { name: true, slug: true, averageRating: true, reviewCount: true } },
        category: { select: { name: true } },
        variants: true,
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const existing = await getPrisma().productCompare.findFirst({
      where: { userId: payload.userId, productId },
    })

    if (existing) {
      return NextResponse.json({ error: 'Product already in comparison list' }, { status: 400 })
    }

    const count = await getPrisma().productCompare.count({
      where: { userId: payload.userId },
    })

    if (count >= 4) {
      return NextResponse.json({ error: 'Maximum 4 products can be compared' }, { status: 400 })
    }

    await getPrisma().productCompare.create({
      data: { userId: payload.userId, productId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding to compare:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const compares = await getPrisma().productCompare.findMany({
      where: { userId: payload.userId },
      select: { productId: true, addedAt: true },
      orderBy: { addedAt: 'desc' },
    })

    const productIds = compares.map((c) => c.productId)

    const products = await getPrisma().product.findMany({
      where: { id: { in: productIds } },
      include: {
        images: true,
        store: { select: { name: true, slug: true, averageRating: true, reviewCount: true } },
        category: { select: { name: true } },
        variants: true,
      },
    })

    return NextResponse.json({ products, count: products.length })
  } catch (error) {
    console.error('Error fetching compare list:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const existing = await getPrisma().productCompare.findFirst({
      where: { userId: payload.userId, productId },
    })

    if (existing) {
      await getPrisma().productCompare.delete({ where: { id: existing.id } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing from compare:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}