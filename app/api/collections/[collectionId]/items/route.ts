import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest, { params }: { params: { collectionId: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { collectionId } = params
    const { productId, serviceId } = await request.json()

    const collection = await getPrisma().collection.findUnique({
      where: { id: collectionId },
      select: { userId: true },
    })

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    if (collection.userId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (productId) {
      const product = await getPrisma().product.findUnique({ where: { id: productId } })
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

      const existing = await getPrisma().collectionItem.findFirst({
        where: { collectionId, productId },
      })
      if (existing) {
        return NextResponse.json({ error: 'Product already in collection' }, { status: 400 })
      }

      await getPrisma().collectionItem.create({
        data: { collectionId, productId },
      })
    }

    if (serviceId) {
      const service = await getPrisma().service.findUnique({ where: { id: serviceId } })
      if (!service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      }

      const existing = await getPrisma().collectionItem.findFirst({
        where: { collectionId, serviceId },
      })
      if (existing) {
        return NextResponse.json({ error: 'Service already in collection' }, { status: 400 })
      }

      await getPrisma().collectionItem.create({
        data: { collectionId, serviceId },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding item to collection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { collectionId: string; itemId: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { collectionId, itemId } = params
    const item = await getPrisma().collectionItem.findUnique({
      where: { id: itemId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const collection = await getPrisma().collection.findUnique({
      where: { id: item.collectionId },
      select: { userId: true },
    })

    if (!collection || collection.userId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await getPrisma().collectionItem.delete({ where: { id: itemId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing item from collection:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}