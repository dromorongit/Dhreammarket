import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    if (payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup before managing products' }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 })
    }

    const product = await getPrisma().product.findUnique({
      where: { id: params.id },
      include: {
        variants: true,
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.storeId !== store.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const allowedFields = ['price', 'salesPrice', 'stock']
    const unknownFields = Object.keys(body).filter((key) => !allowedFields.includes(key))
    if (unknownFields.length > 0) {
      return NextResponse.json({ error: `Unknown fields: ${unknownFields.join(', ')}` }, { status: 400 })
    }

    const { price, salesPrice, stock } = body as Record<string, any>

    const hasVariants = product.variants && product.variants.length > 0
    if (hasVariants) {
      const priceChanged = price !== undefined && price !== null
      const stockChanged = stock !== undefined && stock !== null
      if (priceChanged || stockChanged) {
        return NextResponse.json(
          { error: 'This product has variants. Edit price and stock on the web dashboard.' },
          { status: 409 }
        )
      }
    }

    const updateData: any = {}

    if (price !== undefined && price !== null) {
      const priceNum = parseFloat(price)
      if (isNaN(priceNum) || priceNum < 0) {
        return NextResponse.json({ error: 'Valid price is required' }, { status: 400 })
      }
      updateData.price = priceNum
    }

    if (salesPrice !== undefined && salesPrice !== null) {
      const salesPriceNum = parseFloat(salesPrice)
      if (isNaN(salesPriceNum) || salesPriceNum < 0) {
        return NextResponse.json({ error: 'Invalid sales price' }, { status: 400 })
      }
      updateData.salesPrice = salesPriceNum
    }

    if (stock !== undefined && stock !== null) {
      const stockNum = parseInt(stock, 10)
      if (isNaN(stockNum) || stockNum < 0) {
        return NextResponse.json({ error: 'Valid stock quantity is required' }, { status: 400 })
      }
      if (stockNum < product.reservedQuantity) {
        return NextResponse.json(
          { error: `Stock cannot be below reserved quantity (${product.reservedQuantity})` },
          { status: 400 }
        )
      }
      updateData.stock = stockNum
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const beforeData = {
      price: product.price,
      salesPrice: product.salesPrice,
      stock: product.stock,
    }

    const updatedProduct = await getPrisma().product.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        price: true,
        salesPrice: true,
        stock: true,
      },
    })

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'PRODUCT_UPDATED',
      entityType: 'PRODUCT',
      entityId: params.id,
      beforeData,
      afterData: {
        price: updatedProduct.price,
        salesPrice: updatedProduct.salesPrice,
        stock: updatedProduct.stock,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    })
  } catch (error) {
    console.error('Error quick-updating product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
