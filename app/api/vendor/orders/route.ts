import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if vendor has completed onboarding (store and category)
    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup to view orders' }, { status: 403 })
    }

    // Get vendor's store
    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
      include: {
        products: {
          select: { id: true },
        },
      },
    })

    if (!store) {
      return NextResponse.json({ orderItems: [] })
    }

    const productIds = store.products?.map((p: { id: string }) => p.id) || []
    
    // If no products, return empty order items
    if (productIds.length === 0) {
      return NextResponse.json({ orderItems: [] })
    }

    // Get order items for vendor's products - only paid orders
    const orderItems = await getPrisma().orderItem.findMany({
      where: {
        productId: { in: productIds },
        order: {
          paymentStatus: 'PAID', // Only show paid orders to vendors
        },
      },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
    })

    return NextResponse.json({ orderItems })
  } catch (error) {
    console.error('Error fetching vendor orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}