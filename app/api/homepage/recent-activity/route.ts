import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface RecentActivity {
  type: 'PRODUCT' | 'SERVICE'
  message: string
  productName?: string
  serviceName?: string
  city?: string
  timestamp: string
}

const FALLBACK_MESSAGE = 'Someone just bought'

function buildProductMessage(city: string | null, productName: string): string {
  if (city) {
    return `Someone in ${city} just bought ${productName}`
  }
  return `${FALLBACK_MESSAGE} ${productName}`
}

function buildServiceMessage(city: string | null, serviceName: string): string {
  if (city) {
    return `Someone in ${city} just booked a ${serviceName}`
  }
  return `Someone just booked a ${serviceName}`
}

export async function GET(request: NextRequest) {
  try {
    const prisma = getPrisma()

    const recentProductOrders = await prisma.order.findMany({
      where: {
        status: { in: ['COMPLETED', 'DELIVERED'] },
        paymentStatus: 'PAID',
        deletedAt: null,
      },
      include: {
        items: {
          take: 1,
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const recentServiceRequests = await prisma.serviceRequest.findMany({
      where: {
        status: 'COMPLETED',
        cancelledAt: null,
      },
      include: {
        service: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    })

    const activities: RecentActivity[] = []

    for (const order of recentProductOrders as any[]) {
      const items = order.items ?? []
      const item = items[0]
      if (!item?.product) continue

      const city = (order.customerCity?.trim() || null) as string | null
      const productName = item.product.name.trim()

      activities.push({
        type: 'PRODUCT',
        message: buildProductMessage(city, productName),
        productName,
        city: city || undefined,
        timestamp: order.createdAt.toISOString(),
      })
    }

    for (const request of recentServiceRequests as any[]) {
      if (!request.service) continue

      const serviceName = request.service.title.trim()

      activities.push({
        type: 'SERVICE',
        message: buildServiceMessage(null, serviceName),
        serviceName,
        timestamp: request.completedAt?.toISOString() || request.createdAt.toISOString(),
      })
    }

    activities.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime()
      const bTime = new Date(b.timestamp).getTime()
      return bTime - aTime
    })

    const limited = activities.slice(0, 10)

    const response = NextResponse.json({ activities: limited })
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60, max-age=15')
    return response
  } catch (error) {
    console.error('Error fetching recent marketplace activity:', error)
    return NextResponse.json({ activities: [] }, { status: 200 })
  }
}
