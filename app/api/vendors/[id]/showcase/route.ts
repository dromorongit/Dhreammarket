import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const vendorId = params.id

    const store = await getPrisma().store.findUnique({
      where: { userId: vendorId },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true, avatar: true } },
          },
        },
        vendor_categories: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: true, services: true } },
      },
    })

    if (!store) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const [featuredProducts, featuredServices, reviews, followers, badges] = await Promise.all([
      getPrisma().product.findMany({
        where: { storeId: store.id, isSponsored: true },
        include: { images: { take: 1 } },
        take: 5,
      }),
      getPrisma().service.findMany({
        where: { vendorId, status: 'PUBLISHED', isActive: true },
        take: 5,
      }),
      getPrisma().vendorReview.findMany({
        where: { storeId: store.id, isApproved: true, isHidden: false },
        include: { user: { select: { profile: { select: { firstName: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      getPrisma().vendorFollow.count({ where: { vendorId } }),
      getPrisma().vendorTrustBadge.findMany({
        where: { vendorId, isActive: true },
      }),
    ])

    return NextResponse.json({
      vendor: {
        ...store,
        featuredProducts,
        featuredServices,
        reviews,
        followerCount: followers,
        badges,
      },
    })
  } catch (error) {
    console.error('Error fetching vendor showcase:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}