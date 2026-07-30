import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { title, description, discountType, discountValue, maxDiscount, startDate, endDate, vendorId } = await request.json()

    if (!title || !startDate || !endDate || discountValue === undefined) {
      return NextResponse.json({ error: 'Title, dates, and discount value are required' }, { status: 400 })
    }

    const deal = await getPrisma().flashDeal.create({
      data: {
        title,
        description: description || null,
        discountType: discountType || 'PERCENTAGE',
        discountValue,
        maxDiscount: maxDiscount || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        vendorId: vendorId || null,
      },
    })

    return NextResponse.json({ deal }, { status: 201 })
  } catch (error) {
    console.error('Error creating flash deal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const vendorId = request.nextUrl.searchParams.get('vendorId')

    const where: any = {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    }

    if (vendorId) {
      where.vendorId = vendorId
    }

    const deals = await getPrisma().flashDeal.findMany({
      where,
      include: {
        products: {
          include: {
            product: {
              include: {
                images: true,
                store: { select: { name: true, slug: true, averageRating: true, reviewCount: true } },
              },
            },
            service: {
              include: {
                images: true,
                store: { select: { name: true, slug: true, averageRating: true, reviewCount: true } },
              },
            },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json({ deals })
  } catch (error) {
    console.error('Error fetching flash deals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}