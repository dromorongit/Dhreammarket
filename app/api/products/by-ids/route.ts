import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ids: string[] = body?.ids

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ products: [] })
    }

    const products = await getPrisma().product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        salesPrice: true,
        dealsPrice: true,
        stock: true,
        images: { take: 1, select: { url: true, alt: true } },
        store: { select: { name: true } },
      },
    })

    const productMap = new Map(products.map((p) => [p.id, p]))

    const ordered = ids
      .map((id) => productMap.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        salesPrice: p.salesPrice,
        dealsPrice: p.dealsPrice,
        stock: p.stock,
        image: p.images?.[0]?.url ?? null,
        imageAlt: p.images?.[0]?.alt ?? null,
        storeName: p.store?.name ?? null,
      }))

    return NextResponse.json({ products: ordered })
  } catch (error) {
    console.error('Error fetching products by ids:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
