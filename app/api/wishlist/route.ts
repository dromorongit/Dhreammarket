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

    let wishlist: { id: string; items: any[] } | null = null
    try {
      wishlist = await getPrisma().wishlist.findUnique({
        where: { userId: payload.userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  price: true,
                  stock: true,
                  salesPrice: true,
                  dealsPrice: true,
                  availabilityType: true,
                  images: true,
                  store: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
      console.log('[wishlist/GET] wishlist.findUnique succeeded, wishlistId:', wishlist?.id)
    } catch (e) {
      console.error('[wishlist/GET] wishlist.findUnique FAILED:', e)
    }

    if (!wishlist) {
      return NextResponse.json({
        wishlist: {
          id: null,
          items: [],
        },
      })
    }

    return NextResponse.json({
      wishlist: {
        id: wishlist.id,
        items: wishlist.items || [],
      },
    })
  } catch (error) {
    console.error('Error fetching wishlist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    const { productId } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    let product: { id: string } | null = null
    try {
      product = await getPrisma().product.findUnique({
        where: { id: productId },
      })
      console.log('[wishlist/POST] product.findUnique succeeded, productId:', productId)
    } catch (e) {
      console.error('[wishlist/POST] product.findUnique FAILED:', e)
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    let wishlist: { id: string } | null = null
    try {
      wishlist = await getPrisma().wishlist.findUnique({
        where: { userId: payload.userId },
      })
      console.log('[wishlist/POST] wishlist.findUnique succeeded, existingWishlist:', wishlist?.id)
    } catch (e) {
      console.error('[wishlist/POST] wishlist.findUnique FAILED:', e)
    }

    if (!wishlist) {
      try {
        wishlist = await getPrisma().wishlist.create({
          data: { userId: payload.userId },
        })
        console.log('[wishlist/POST] wishlist.create succeeded, newWishlistId:', wishlist.id)
      } catch (e) {
        console.error('[wishlist/POST] wishlist.create FAILED:', e)
        return NextResponse.json({ error: 'Could not create wishlist' }, { status: 500 })
      }
    }

    try {
      await getPrisma().wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId,
        },
      })
      console.log('[wishlist/POST] wishlistItem.create succeeded')
    } catch (e: any) {
      if (e?.code === 'P2002') {
        console.log('[wishlist/POST] Item already exists in wishlist')
      } else {
        console.error('[wishlist/POST] wishlistItem.create FAILED:', e)
        return NextResponse.json({ error: 'Could not add to wishlist' }, { status: 500 })
      }
    }

    let updatedWishlist: { id: string; items: any[] } | null = null
    try {
      updatedWishlist = await getPrisma().wishlist.findUnique({
        where: { userId: payload.userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  price: true,
                  stock: true,
                  salesPrice: true,
                  dealsPrice: true,
                  availabilityType: true,
                  images: true,
                  store: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
      console.log('[wishlist/POST] updated wishlist.findUnique succeeded')
    } catch (e) {
      console.error('[wishlist/POST] updated wishlist.findUnique FAILED:', e)
    }

    return NextResponse.json({
      wishlist: {
        id: updatedWishlist?.id ?? wishlist.id,
        items: updatedWishlist?.items || [],
      },
    })
  } catch (error) {
    console.error('Error adding to wishlist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}