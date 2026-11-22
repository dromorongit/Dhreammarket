import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const revalidate = 300

export async function GET() {
  try {
    const prisma = getPrisma()

    const [vendorCount, productCount, happyCustomers, ordersDelivered] = await Promise.all([
      prisma.user.count({ where: { role: 'VENDOR' } }),
      prisma.product.count(),
      prisma.user.count({
        where: {
          orders: {
            some: {
              status: { in: ['DELIVERED', 'COMPLETED'] },
              paymentStatus: 'PAID',
            },
          },
        },
      }),
      prisma.order.count({
        where: {
          status: { in: ['DELIVERED', 'COMPLETED'] },
          paymentStatus: 'PAID',
        },
      }),
    ])

    return NextResponse.json({
      vendors: vendorCount,
      products: productCount,
      happyCustomers,
      ordersDelivered,
    })
  } catch (error) {
    console.error('Error fetching public stats:', error)
    return NextResponse.json(
      {
        vendors: 0,
        products: 0,
        happyCustomers: 0,
        ordersDelivered: 0,
      },
      { status: 500 }
    )
  }
}
