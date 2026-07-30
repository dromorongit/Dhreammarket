import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { productId, serviceId, dealPrice } = await request.json()

    if (!dealPrice) {
      return NextResponse.json({ error: 'Deal price is required' }, { status: 400 })
    }

    if (!productId && !serviceId) {
      return NextResponse.json({ error: 'Product ID or Service ID is required' }, { status: 400 })
    }

    const dealProduct = await getPrisma().flashDealProduct.create({
      data: {
        flashDealId: params.id,
        productId: productId || null,
        serviceId: serviceId || null,
        dealPrice,
      },
    })

    return NextResponse.json({ dealProduct }, { status: 201 })
  } catch (error) {
    console.error('Error adding product to flash deal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; productId: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const dealProduct = await getPrisma().flashDealProduct.findFirst({
      where: { flashDealId: params.id, productId: params.productId || null },
    })

    if (dealProduct) {
      await getPrisma().flashDealProduct.delete({ where: { id: dealProduct.id } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing product from flash deal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}