import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

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

    // Get user's cart with safe fallback
    let cart: any = null
    try {
      cart = await getPrisma().cart.findUnique({
        where: { userId: payload.userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: true,
                },
              },
            },
          },
        },
      })
      console.log('[cart/GET] cart.findUnique succeeded, cartId:', cart?.id)
    } catch (e) {
      console.error('[cart/GET] cart.findUnique FAILED:', e)
    }

    if (!cart) {
      return NextResponse.json({
        cart: {
          id: null,
          items: [],
          total: 0,
        }
      })
    }

    // Calculate total with safe access
    const total = (cart.items || []).reduce(
      (sum: number, item: any) => sum + ((item?.product?.price ?? 0) * (item?.quantity ?? 0)),
      0
    )

    return NextResponse.json({
      cart: {
        id: cart.id,
        items: cart.items || [],
        total,
      }
    })
  } catch (error) {
    console.error('Error fetching cart:', error)
    return NextResponse.json({
      cart: { id: null, items: [], total: 0 }
    }, { status: 200 })
  }
}

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

    const { productId, quantity = 1 } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    if (quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 })
    }

    // Verify product exists and has stock
    let product: any = null
    try {
      product = await getPrisma().product.findUnique({
        where: { id: productId },
      })
      console.log('[cart/POST] product.findUnique succeeded, productId:', productId)
    } catch (e) {
      console.error('[cart/POST] product.findUnique FAILED:', e)
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.stock < quantity) {
      return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
    }

    // Get or create cart
    let cart: any = null
    try {
      cart = await getPrisma().cart.findUnique({
        where: { userId: payload.userId },
      })
      console.log('[cart/POST] cart.findUnique succeeded, existingCart:', cart?.id)
    } catch (e) {
      console.error('[cart/POST] cart.findUnique FAILED:', e)
    }

    if (!cart) {
      try {
        cart = await getPrisma().cart.create({
          data: { userId: payload.userId },
        })
        console.log('[cart/POST] cart.create succeeded, newCartId:', cart.id)
      } catch (e) {
        console.error('[cart/POST] cart.create FAILED:', e)
        return NextResponse.json({ error: 'Could not create cart' }, { status: 500 })
      }
    }

    // Check if item already in cart
    let existingItem: any = null
    try {
      existingItem = await getPrisma().cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId,
          },
        },
      })
      console.log('[cart/POST] cartItem.findUnique succeeded')
    } catch (e) {
      console.error('[cart/POST] cartItem.findUnique FAILED:', e)
    }

    if (existingItem) {
      // Update quantity
      try {
        await getPrisma().cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + quantity },
        })
        console.log('[cart/POST] cartItem.update succeeded')
      } catch (e) {
        console.error('[cart/POST] cartItem.update FAILED:', e)
      }
    } else {
      // Create new item
      try {
        await getPrisma().cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity,
          },
        })
        console.log('[cart/POST] cartItem.create succeeded')
      } catch (e) {
        console.error('[cart/POST] cartItem.create FAILED:', e)
      }
    }

    // Return updated cart
    let updatedCart: any = null
    try {
      updatedCart = await getPrisma().cart.findUnique({
        where: { userId: payload.userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: true,
                },
              },
            },
          },
        },
      })
      console.log('[cart/POST] updated cart.findUnique succeeded')
    } catch (e) {
      console.error('[cart/POST] updated cart.findUnique FAILED:', e)
    }

    const total = (updatedCart?.items || []).reduce(
      (sum: number, item: any) => sum + ((item?.product?.price ?? 0) * (item?.quantity ?? 0)),
      0
    )

    return NextResponse.json({
      cart: {
        id: updatedCart?.id,
        items: updatedCart?.items || [],
        total,
      }
    })
  } catch (error) {
    console.error('Error adding to cart:', error)
    return NextResponse.json({
      cart: { id: null, items: [], total: 0 }
    }, { status: 200 })
  }
}