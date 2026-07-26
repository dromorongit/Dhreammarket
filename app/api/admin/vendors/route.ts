import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET all vendors with optional verification filter
export async function GET(request: NextRequest) {
  console.log('[ADMIN VENDORS] GET request started')
  try {
    const prisma = getPrisma()
    console.log('[ADMIN VENDORS] Prisma client obtained')
    const authCheck = requireAdmin()
    console.log('[ADMIN VENDORS] Auth check result:', authCheck instanceof NextResponse ? `response ${authCheck.status}` : 'authorized')
    if (authCheck instanceof NextResponse) {
      console.log('[ADMIN VENDORS] Auth check returned error response:', authCheck.status)
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const verified = searchParams.get('verified')
    const search = searchParams.get('search')
    console.log('[ADMIN VENDORS] Query params:', { page, limit, verified, search })

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      user: { role: 'VENDOR' },
    }
    
    if (verified !== null) {
      where.isVerified = verified === 'true'
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Get stores and their product IDs for revenue calculation
    console.log('[ADMIN VENDORS] Query: prisma.store.findMany')
    const storesWithProducts = await prisma.store.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
        products: {
          select: { id: true },
        },
        _count: {
          select: { products: true },
        },
      },
    })

    console.log('[ADMIN VENDORS] Query: prisma.store.count')
    const total = await prisma.store.count({ where })
    const totalPages = Math.ceil(total / limit)

    // Fetch revenue and payout data for all vendors in bulk
    const productIds = storesWithProducts.flatMap((store) => store.products.map((p) => p.id))
    const vendorUserIds = storesWithProducts.map((store) => store.userId)

    const paidOutByVendor = new Map<string, number>()
    const grossRevenueByProduct = new Map<string, number>()
    const vendorEarningsByProduct = new Map<string, number>()

    await Promise.all([
      vendorUserIds.length > 0
        ? prisma.vendorPayout.groupBy({
            by: ['vendorId'],
            where: {
              vendorId: { in: vendorUserIds },
              status: 'PAID',
            },
            _sum: { amount: true },
          }).then((payoutGroups) => {
            for (const group of payoutGroups) {
              paidOutByVendor.set(group.vendorId, group._sum.amount || 0)
            }
          })
        : Promise.resolve(),
      productIds.length > 0
        ? prisma.orderItem.findMany({
            where: {
              productId: { in: productIds },
              order: {
                paymentStatus: 'PAID',
                status: { in: ['COMPLETED', 'DELIVERED'] },
              },
            },
            select: {
              productId: true,
              price: true,
              quantity: true,
              vendorEarnings: true,
            },
          }).then((allOrderItems) => {
            for (const item of allOrderItems) {
              grossRevenueByProduct.set(
                item.productId,
                (grossRevenueByProduct.get(item.productId) || 0) + item.price * item.quantity
              )
              vendorEarningsByProduct.set(
                item.productId,
                (vendorEarningsByProduct.get(item.productId) || 0) + (item.vendorEarnings || 0)
              )
            }
          })
        : Promise.resolve(),
    ])

    const vendorsWithMetrics = storesWithProducts.map((store) => {
      const storeProductIds = store.products.map((p) => p.id)

      let grossRevenue = 0
      let outstandingBalance = 0
      for (const pid of storeProductIds) {
        grossRevenue += grossRevenueByProduct.get(pid) || 0
        outstandingBalance += vendorEarningsByProduct.get(pid) || 0
      }

      const paidOut = paidOutByVendor.get(store.userId) || 0
      outstandingBalance = Math.max(0, outstandingBalance - paidOut)

      return {
        id: store.id,
        name: store.name,
        description: store.description,
        isVerified: store.isVerified,
        isFeatured: store.isFeatured,
        badgeTier: store.badgeTier,
        featuredUntil: store.featuredUntil ? store.featuredUntil.toISOString() : null,
        createdAt: store.user.createdAt,
        mobileNumber: store.mainPhoneNumber,
        location: store.location,
        user: {
          id: store.user.id,
          email: store.user.email,
          role: store.user.role,
          createdAt: store.user.createdAt,
        },
        _count: {
          products: store._count.products,
        },
        grossRevenue,
        totalPayouts: paidOut,
        outstandingBalance,
      }
    })

    const vendors = vendorsWithMetrics
    console.log('[ADMIN VENDORS] Returning response, vendors count:', vendors.length)

    return NextResponse.json({
      vendors,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('[ADMIN VENDORS] Error:', error)
    console.error('[ADMIN VENDORS] Error stack:', (error as any)?.stack)
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 })
  }
}