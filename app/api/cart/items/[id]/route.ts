import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { getUnitPrice } from '@/lib/pricing'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

    const cartItemId = params.id
    const { quantity } = await request.json()

    if (quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 })
    }

    // Get cart item and verify ownership
    const cartItem = await getPrisma().cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
        product: true,
        productVariant: true,
      },
    })

    if (!cartItem) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
    }

    if (cartItem.cart.userId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check stock (variant stock takes precedence)
    const stockToCheck = (cartItem.productVariant?.stock ?? cartItem.product.stock) - (cartItem.productVariant?.reservedQuantity ?? cartItem.product.reservedQuantity ?? 0)
    const isPreorderOrBackorder = cartItem.product.availabilityType === 'PREORDER' || 
                                  cartItem.product.availabilityType === 'BACKORDER'
    // Skip stock validation for preorder/backorder items
    if (!isPreorderOrBackorder && stockToCheck < quantity) {
      return NextResponse.json({ error: `Insufficient stock. Available: ${stockToCheck}` }, { status: 400 })
    }

    // Update quantity
    await getPrisma().cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    })

    // Return updated cart
    const updatedCart = await getPrisma().cart.findUnique({
      where: { userId: payload.userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                dealsPrice: true,
                salesPrice: true,
                stock: true,
                reservedQuantity: true,
                availabilityType: true,
                expectedArrivalDate: true,
                estimatedFulfillmentDays: true,
                preOrderNotes: true,
                expectedRestockDate: true,
                backOrderNotes: true,
                images: true,
              },
            },
            productVariant: true,
          },
        },
      },
    })

    const patchedItems = (updatedCart?.items || []).map((item: any) => ({
      ...item,
      effectivePrice: getUnitPrice(item.product, item.productVariant),
    }))
    const total = patchedItems.reduce(
      (sum: number, item: any) => sum + (item.effectivePrice * (item.quantity ?? 0)),
      0
    )

    return NextResponse.json({
      cart: {
        id: updatedCart?.id,
        items: patchedItems,
        total,
      }
    })
  } catch (error) {
    console.error('Error updating cart item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    const cartItemId = params.id

    // Get cart item and verify ownership
    const cartItem = await getPrisma().cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
      },
    })

    if (!cartItem) {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 })
    }

    if (cartItem.cart.userId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete item
    await getPrisma().cartItem.delete({
      where: { id: cartItemId },
    })

    // Return updated cart
    const updatedCart = await getPrisma().cart.findUnique({
      where: { userId: payload.userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                dealsPrice: true,
                salesPrice: true,
                stock: true,
                reservedQuantity: true,
                availabilityType: true,
                expectedArrivalDate: true,
                estimatedFulfillmentDays: true,
                preOrderNotes: true,
                expectedRestockDate: true,
                backOrderNotes: true,
                images: true,
              },
            },
            productVariant: true,
          },
        },
      },
    })

    const deletedItems = (updatedCart?.items || []).map((item: any) => ({
      ...item,
      effectivePrice: getUnitPrice(item.product, item.productVariant),
    }))
    const total = deletedItems.reduce(
      (sum: number, item: any) => sum + (item.effectivePrice * (item.quantity ?? 0)),
      0
    )

    return NextResponse.json({
      cart: {
        id: updatedCart?.id,
        items: deletedItems,
        total,
      }
    })
  } catch (error) {
    console.error('Error deleting cart item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}