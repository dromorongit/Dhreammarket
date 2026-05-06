import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const categories = await getPrisma().vendorCategory.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        slug: true,
      }
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching vendor categories:', error)
    return NextResponse.json({ error: 'Failed to fetch vendor categories' }, { status: 500 })
  }
}
