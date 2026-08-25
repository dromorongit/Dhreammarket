import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const FEATURED_COUNT = 6

export async function GET() {
  const prisma = getPrisma()

  const where: any = {
    OR: [
      { stock: { gt: 0 } },
      { availabilityType: 'PREORDER' },
      { availabilityType: 'BACKORDER' },
    ],
  }

  const total = await prisma.product.count({ where })

  if (total === 0) {
    return NextResponse.json({ products: [] })
  }

  const countToFetch = Math.min(FEATURED_COUNT, total)
  const offsets = new Set<number>()
  while (offsets.size < countToFetch) {
    offsets.add(Math.floor(Math.random() * total))
  }

  const products = await Promise.all(
    Array.from(offsets).map((offset) =>
      prisma.product.findFirst({
        where,
        skip: offset,
        select: {
          id: true,
          slug: true,
          name: true,
          price: true,
          averageRating: true,
          images: { take: 1, select: { url: true, alt: true } },
          category: { select: { id: true, name: true, slug: true } },
          store: { select: { name: true } },
        },
      })
    )
  )

  const valid = products.filter((p): p is NonNullable<typeof p> => p !== null)

  return NextResponse.json({ products: valid })
}
