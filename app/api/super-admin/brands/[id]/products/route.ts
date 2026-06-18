import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// POST assign products to brand
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { id } = await params
    const { productIds } = await request.json()

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'productIds array is required' }, { status: 400 })
    }

    const brand = await prisma.brand.findUnique({ where: { id } })
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    })

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Some products were not found' }, { status: 404 })
    }

    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: {
        brandId: id,
        brand: brand.name,
      },
    })

const updated = await prisma.product.findMany({
       where: { brandId: id },
       include: {
         images: true,
         store: { select: { id: true, name: true, isVerified: true, badgeTier: true } },
       },
       orderBy: { name: 'asc' }
     })

     const formatted = updated.map((p: any) => ({
       ...p,
       availabilityType: p.availabilityType,
       expectedArrivalDate: p.expectedArrivalDate,
       estimatedFulfillmentDays: p.estimatedFulfillmentDays,
       preOrderNotes: p.preOrderNotes,
       expectedRestockDate: p.expectedRestockDate,
       backOrderNotes: p.backOrderNotes,
     }))

     return NextResponse.json({ products: formatted })
  } catch (error) {
    console.error('Assign products to brand error:', error)
    return NextResponse.json({ error: 'Failed to assign products' }, { status: 500 })
  }
}

// DELETE remove product from brand
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = requireSuperAdmin()
    if (authCheck instanceof NextResponse) return authCheck

    const prisma = getPrisma()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({ error: 'productId query parameter is required' }, { status: 400 })
    }

    await prisma.product.updateMany({
      where: { id: productId, brandId: id },
      data: { brandId: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove product from brand error:', error)
    return NextResponse.json({ error: 'Failed to remove product' }, { status: 500 })
  }
}
