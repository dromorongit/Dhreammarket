import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

// Get the current vendor's earnings history
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
      return NextResponse.json({ error: 'Complete store setup to view earnings' }, { status: 403 })
    }

    // Get vendor's store
    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ earnings: [] })
    }

    // Get product IDs for this vendor
    const products = await getPrisma().product.findMany({
      where: { storeId: store.id },
      select: { id: true }
    })
    const productIds = products.map((p: { id: string }) => p.id)

    if (productIds.length === 0) {
      return NextResponse.json({ earnings: [] })
    }

    // Get order items for this vendor's products from paid orders
    const earnings = await getPrisma().orderItem.findMany({
      where: {
        productId: { in: productIds },
        order: {
          paymentStatus: 'PAID'
        }
      },
      select: {
        id: true,
        orderId: true,
        productId: true,
        quantity: true,
        price: true,
        grossAmount: true,
        processorFee: true,
        netAmount: true,
        platformCommission: true,
        vendorEarnings: true,
        commissionRate: true,
        createdAt: true,
        product: {
          select: { name: true }
        },
        order: {
          select: {
            id: true,
            createdAt: true,
            paymentStatus: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ earnings })
  } catch (error) {
    console.error('Error fetching vendor earnings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}