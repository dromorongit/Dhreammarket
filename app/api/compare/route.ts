import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import {
  PUBLIC_PRODUCT_IMAGE_SELECT,
  PUBLIC_PRODUCT_SELECT,
  PUBLIC_VARIANT_SELECT,
} from '@/lib/public-selects'

// The comparison card shape. Every field is selected on purpose so that the
// vendor's cost price never reaches the buyer.
const COMPARE_PRODUCT_SELECT = {
  ...PUBLIC_PRODUCT_SELECT,
  images: { select: PUBLIC_PRODUCT_IMAGE_SELECT },
  store: { select: { name: true, slug: true, averageRating: true, reviewCount: true } },
  category: { select: { name: true } },
  variants: { select: PUBLIC_VARIANT_SELECT },
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = outcome

    const { productId } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const product = await getPrisma().product.findUnique({
      where: { id: productId },
      select: COMPARE_PRODUCT_SELECT,
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

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = outcome

    const compares = await getPrisma().productCompare.findMany({
      where: { userId: payload.userId },
      select: { productId: true, addedAt: true },
      orderBy: { addedAt: 'desc' },
    })

    const productIds = compares.map((c) => c.productId)

    const products = await getPrisma().product.findMany({
      where: { id: { in: productIds } },
      select: COMPARE_PRODUCT_SELECT,
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

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = outcome

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