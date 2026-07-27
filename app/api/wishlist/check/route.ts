import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ productIds: [], serviceIds: [] })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ productIds: [], serviceIds: [] })
    }

    const productIdsParam = request.nextUrl.searchParams.get('productIds')
    const serviceIdsParam = request.nextUrl.searchParams.get('serviceIds')

    const productIds = productIdsParam?.split(',').filter(Boolean) ?? []
    const serviceIds = serviceIdsParam?.split(',').filter(Boolean) ?? []

    if (productIds.length === 0 && serviceIds.length === 0) {
      return NextResponse.json({ productIds: [], serviceIds: [] })
    }

    let wishlist: { id: string } | null = null
    try {
      wishlist = await getPrisma().wishlist.findUnique({
        where: { userId: payload.userId },
      })
    } catch (e) {
      console.error('[wishlist/check] wishlist.findUnique FAILED:', e)
      return NextResponse.json({ productIds: [], serviceIds: [] })
    }

    if (!wishlist) {
      return NextResponse.json({ productIds: [], serviceIds: [] })
    }

    const wishlistedProductIds = productIds.length > 0
      ? (await getPrisma().wishlistItem.findMany({
          where: { wishlistId: wishlist.id, productId: { in: productIds } },
          select: { productId: true },
        })).map((item) => item.productId!)
      : []

    const wishlistedServiceIds = serviceIds.length > 0
      ? (await getPrisma().wishlistItem.findMany({
          where: { wishlistId: wishlist.id, serviceId: { in: serviceIds } },
          select: { serviceId: true },
        })).map((item) => item.serviceId!)
      : []

    return NextResponse.json({
      productIds: wishlistedProductIds,
      serviceIds: wishlistedServiceIds,
    })
  } catch (error) {
    console.error('Error checking wishlist status:', error)
    return NextResponse.json({ productIds: [], serviceIds: [] })
  }
}