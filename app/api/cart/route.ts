import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { PerformanceLogger } from '@/lib/performance'

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
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
                select: {
                  id: true,
                  name: true,
                  price: true,
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
    } catch (e) {
      console.error('[cart/GET] cart.findUnique FAILED:', e)
    }
    perf.markPrismaEnd(prismaPerfStart)

    if (!cart) {
      perf.log()
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

    perf.log()
    return NextResponse.json({
      cart: {
        id: cart.id,
        items: cart.items || [],
        total,
      }
    })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching cart:', error)
    return NextResponse.json({
      cart: { id: null, items: [], total: 0 }
    }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId, quantity = 1, productVariantId, color, size, age } = await request.json()

    if (!productId) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    if (quantity <= 0) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 })
    }

    // Verify product exists
    let product: any = null
    try {
      product = await getPrisma().product.findUnique({
        where: { id: productId },
        include: {
          variants: {
            select: {
              id: true,
              stock: true,
              reservedQuantity: true,
              active: true,
            },
          },
        },
      })
    } catch (e) {
      console.error('[cart/POST] product.findUnique FAILED:', e)
    }
    perf.markPrismaEnd(prismaPerfStart)

    if (!product) {
      perf.log()
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    let availableStock = product.stock - (product.reservedQuantity || 0)
    const isPreorderOrBackorder = product.availabilityType === 'PREORDER' || 
                                    product.availabilityType === 'BACKORDER'
    if (productVariantId) {
      const variant = product.variants?.find((v: any) => v.id === productVariantId)
      if (variant) {
        availableStock = variant.stock - (variant.reservedQuantity || 0)
      }
    }

    // Skip stock validation for preorder/backorder items
    if (!isPreorderOrBackorder && availableStock < quantity) {
      perf.log()
      return NextResponse.json({ error: `Insufficient stock. Available: ${availableStock}` }, { status: 400 })
    }

    // Get or create cart
    let cart: any = null
    try {
      cart = await getPrisma().cart.findUnique({
        where: { userId: payload.userId },
      })
    } catch (e) {
      console.error('[cart/POST] cart.findUnique FAILED:', e)
    }
    perf.markPrismaEnd(prismaPerfStart)

    if (!cart) {
      try {
        cart = await getPrisma().cart.create({
          data: { userId: payload.userId },
        })
        console.log('[cart/POST] cart.create succeeded, newCartId:', cart.id)
      } catch (e) {
        console.error('[cart/POST] cart.create FAILED:', e)
        perf.log()
        return NextResponse.json({ error: 'Could not create cart' }, { status: 500 })
      }
    }

    // Build composite unique key for cart item
    const cartItemWhere: any = {
      cartId_productId: {
        cartId: cart.id,
        productId,
      },
    }
    
    // If variant is provided, use variant ID for uniqueness
    if (productVariantId) {
      cartItemWhere.productVariantId = productVariantId
    }

    // Check if item already in cart
    let existingItem: any = null
    try {
      existingItem = await getPrisma().cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId,
          productVariantId: productVariantId || null,
        },
      })
      console.log('[cart/POST] cartItem.findFirst succeeded')
    } catch (e) {
      console.error('[cart/POST] cartItem.findFirst FAILED:', e)
    }

    if (existingItem) {
        // Update quantity - validate against stock again
        const newTotalQuantity = existingItem.quantity + quantity
        if (!isPreorderOrBackorder && availableStock < newTotalQuantity) {
          perf.log()
          return NextResponse.json({ error: `Insufficient stock. Available: ${availableStock}` }, { status: 400 })
        }
       try {
          await getPrisma().cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: newTotalQuantity },
          })
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
              productVariantId: productVariantId || null,
              quantity,
              color: color || null,
              size: size || null,
              age: age || null,
            },
          })
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
                select: {
                  id: true,
                  name: true,
                  price: true,
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
    } catch (e) {
      console.error('[cart/POST] updated cart.findUnique FAILED:', e)
    }
    perf.markPrismaEnd(prismaPerfStart)

    const total = (updatedCart?.items || []).reduce(
      (sum: number, item: any) => sum + ((item?.product?.price ?? 0) * (item?.quantity ?? 0)),
      0
    )

    perf.log()
    return NextResponse.json({
      cart: {
        id: updatedCart?.id,
        items: updatedCart?.items || [],
        total,
      }
    })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error adding to cart:', error)
    return NextResponse.json({
      cart: { id: null, items: [], total: 0 }
    }, { status: 200 })
  }
}