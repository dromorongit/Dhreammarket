import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const revalidate = 3600

export async function GET(request: NextRequest) {
  try {
    const prisma = getPrisma()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()

    const where: Record<string, unknown> = { isActive: true }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ]
    }

    const brands = await prisma.brand.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
      },
    })

    const response = NextResponse.json({ brands })
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400, max-age=300')
    return response
  } catch (error) {
    console.error('Brands API error:', error)
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 })
  }
}