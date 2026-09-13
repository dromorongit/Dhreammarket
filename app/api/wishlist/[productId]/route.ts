import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function DELETE(request: NextRequest, { params }: { params: { productId: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const payload = outcome

    const { productId } = params

    let wishlist: { id: string } | null = null
    try {
      wishlist = await getPrisma().wishlist.findUnique({
        where: { userId: payload.userId },
      })
    } catch (e) {
      console.error('[wishlist/DELETE] wishlist.findUnique FAILED:', e)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (!wishlist) {
      return NextResponse.json({ error: 'Item not found in wishlist' }, { status: 404 })
    }

    try {
      await getPrisma().wishlistItem.deleteMany({
        where: {
          wishlistId: wishlist.id,
          productId,
        },
      })
    } catch (e: any) {
      if (e?.code === 'P2025') {
        return NextResponse.json({ error: 'Item not found in wishlist' }, { status: 404 })
      }
      console.error('[wishlist/DELETE] wishlistItem.deleteMany FAILED:', e)
      return NextResponse.json({ error: 'Could not remove from wishlist' }, { status: 500 })
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
      console.error('[wishlist/DELETE] updated wishlist.findUnique FAILED:', e)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      wishlist: {
        id: updatedWishlist?.id ?? wishlist.id,
        items: updatedWishlist?.items || [],
      },
    })
  } catch (error) {
    console.error('Error removing from wishlist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}