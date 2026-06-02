import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET all vendors with optional verification filter
export async function GET(request: NextRequest) {
  try {
    const prisma = getPrisma()
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const verified = searchParams.get('verified')
    const search = searchParams.get('search')

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

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
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
          _count: {
            select: { products: true },
          },
        },
      }),
      prisma.store.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    // Transform stores to vendors format expected by frontend
    // Note: id must be the user.id (not store.id) for compatibility with HomepageSectionVendor
    const vendors = stores.map((store) => ({
      id: store.user.id,
      storeName: store.name,
      name: store.name,
      description: store.description,
      isVerified: store.isVerified,
      isFeatured: store.isFeatured,
      featuredUntil: store.featuredUntil ? store.featuredUntil.toISOString() : null,
      createdAt: store.user.createdAt,
      mobileNumber: store.mainPhoneNumber,
      user: {
        id: store.user.id,
        email: store.user.email,
        role: store.user.role,
        createdAt: store.user.createdAt,
      },
      _count: {
        products: store._count.products,
      },
    }))

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
    console.error('Admin vendors error:', error)
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 })
  }
}