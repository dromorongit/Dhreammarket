import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

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
