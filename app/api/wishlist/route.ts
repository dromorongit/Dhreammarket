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
                    select: { name: true },
                  },
                },
              },
              service: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  startingPrice: true,
                  pricingType: true,
                  availabilityStatus: true,
                  thumbnail: true,
                  gallery: true,
                  store: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      })
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

    const { productId, serviceId } = await request.json()

    if (!productId && !serviceId) {
      return NextResponse.json({ error: 'Product ID or Service ID is required' }, { status: 400 })
    }

    let item
    if (productId) {
      const product = await getPrisma().product.findUnique({ where: { id: productId } })
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
    }

    if (serviceId) {
      const service = await getPrisma().service.findUnique({ where: { id: serviceId } })
      if (!service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      }
    }

    let wishlist: { id: string } | null = null
    try {
      wishlist = await getPrisma().wishlist.findUnique({
        where: { userId: payload.userId },
      })
    } catch (e) {
      console.error('[wishlist/POST] wishlist.findUnique FAILED:', e)
    }

    if (!wishlist) {
      try {
        wishlist = await getPrisma().wishlist.create({
          data: { userId: payload.userId },
        })
      } catch (e) {
        console.error('[wishlist/POST] wishlist.create FAILED:', e)
        return NextResponse.json({ error: 'Could not create wishlist' }, { status: 500 })
      }
    }

    const existingWhere: Record<string, unknown> = { wishlistId: wishlist.id }
    if (productId) {
      existingWhere.productId = productId
    }
    if (serviceId) {
      existingWhere.serviceId = serviceId
    }

    const existingItem = await getPrisma().wishlistItem.findFirst({ where: existingWhere })
    if (existingItem) {
      return NextResponse.json({
        wishlist: { id: wishlist.id, items: [] },
      })
    }

    try {
      await getPrisma().wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId: productId ?? null,
          serviceId: serviceId ?? null,
        },
      })
    } catch (e) {
      console.error('[wishlist/POST] wishlistItem.create FAILED:', e)
      return NextResponse.json({ error: 'Could not add to wishlist' }, { status: 500 })
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
                  id: true, name: true, slug: true, price: true, stock: true,
                  salesPrice: true, dealsPrice: true, availabilityType: true, images: true,
                  store: { select: { name: true } },
                },
              },
              service: {
                select: {
                  id: true, title: true, slug: true, startingPrice: true,
                  pricingType: true, availabilityStatus: true, thumbnail: true,
                  gallery: true, store: { select: { name: true } },
                },
              },
            },
          },
        },
      })
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