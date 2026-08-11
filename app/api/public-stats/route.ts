import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const revalidate = 60

export async function GET() {
  try {
    const prisma = getPrisma()

    const [vendorCount, productCount] = await Promise.all([
      prisma.user.count({ where: { role: 'VENDOR' } }),
      prisma.product.count(),
    ])

    return NextResponse.json({
      vendors: vendorCount,
      products: productCount,
      happyCustomers: 5000,
      ordersDelivered: 500,
    })
  } catch (error) {
    console.error('Error fetching public stats:', error)
    return NextResponse.json(
      {
        vendors: 0,
        products: 0,
        happyCustomers: 5000,
        ordersDelivered: 500,
      },
      { status: 500 }
    )
  }
}
