import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ productIds: [] })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ productIds: [] })
    }

    const productIdsParam = request.nextUrl.searchParams.get('productIds')
    if (!productIdsParam) {
      return NextResponse.json({ productIds: [] })
    }

    const productIds = productIdsParam.split(',').filter(Boolean)

    if (productIds.length === 0) {
      return NextResponse.json({ productIds: [] })
    }

    let wishlist: { id: string } | null = null
    try {
      wishlist = await getPrisma().wishlist.findUnique({
        where: { userId: payload.userId },
      })
    } catch (e) {
      console.error('[wishlist/check] wishlist.findUnique FAILED:', e)
      return NextResponse.json({ productIds: [] })
    }

    if (!wishlist) {
      return NextResponse.json({ productIds: [] })
    }

    const wishlistItems = await getPrisma().wishlistItem.findMany({
      where: {
        wishlistId: wishlist.id,
        productId: { in: productIds },
      },
      select: { productId: true },
    })

    const wishlistedProductIds = wishlistItems.map((item) => item.productId)

    return NextResponse.json({ productIds: wishlistedProductIds })
  } catch (error) {
    console.error('Error checking wishlist status:', error)
    return NextResponse.json({ productIds: [] })
  }
}