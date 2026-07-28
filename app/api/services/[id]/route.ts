import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { PerformanceLogger } from '@/lib/performance'

interface RouteParams {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: RouteParams) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const { id } = await params
    let service = await getPrisma().service.findUnique({
      where: { id },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            isVerified: true,
            logo: true,
            badgeTier: true,
            location: true,
            email: true,
            mainPhoneNumber: true,
            alternativePhoneNumber: true,
            whatsappNumber: true,
            averageRating: true,
            reviewCount: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
          },
        },
        images: {
          orderBy: {
            displayOrder: 'asc',
          },
          select: {
            id: true,
            imageUrl: true,
            displayOrder: true,
          },
        },
      },
    })

    if (!service) {
      service = await getPrisma().service.findUnique({
        where: { slug: id },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
              isVerified: true,
              logo: true,
              badgeTier: true,
              location: true,
              email: true,
              mainPhoneNumber: true,
              alternativePhoneNumber: true,
              whatsappNumber: true,
              averageRating: true,
              reviewCount: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
            },
          },
          images: {
            orderBy: {
              displayOrder: 'asc',
            },
            select: {
              id: true,
              imageUrl: true,
              displayOrder: true,
            },
          },
        },
      })
    }

    perf.markPrismaEnd(prismaPerfStart)

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (service.status !== 'PUBLISHED' || !service.isActive) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    const response = NextResponse.json({ service })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching service:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}