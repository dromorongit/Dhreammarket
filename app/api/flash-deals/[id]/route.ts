import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deal = await getPrisma().flashDeal.findUnique({
      where: { id: params.id },
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
    })

    if (!deal) {
      return NextResponse.json({ error: 'Flash deal not found' }, { status: 404 })
    }

    return NextResponse.json({ deal })
  } catch (error) {
    console.error('Error fetching flash deal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await getPrisma().flashDeal.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting flash deal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { title, description, discountType, discountValue, maxDiscount, startDate, endDate, isActive } = await request.json()

    const existingDeal = await getPrisma().flashDeal.findUnique({
      where: { id: params.id },
    })

    if (!existingDeal) {
      return NextResponse.json({ error: 'Flash deal not found' }, { status: 404 })
    }

    const deal = await getPrisma().flashDeal.update({
      where: { id: params.id },
      data: {
        title: title ?? existingDeal.title,
        description: description ?? existingDeal.description,
        discountType: discountType ?? existingDeal.discountType,
        discountValue: discountValue ?? existingDeal.discountValue,
        maxDiscount: maxDiscount ?? existingDeal.maxDiscount,
        startDate: startDate ? new Date(startDate) : existingDeal.startDate,
        endDate: endDate ? new Date(endDate) : existingDeal.endDate,
        isActive: isActive ?? existingDeal.isActive,
      },
    })

    return NextResponse.json({ deal })
  } catch (error) {
    console.error('Error updating flash deal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
