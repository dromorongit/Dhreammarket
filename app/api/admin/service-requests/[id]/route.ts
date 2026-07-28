import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { PerformanceLogger } from '@/lib/performance'

interface RouteParams {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: RouteParams) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id } = await params

    const requestData = await getPrisma().serviceRequest.findUnique({
      where: { id },
      include: {
        service: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            shortDescription: true,
            startingPrice: true,
            pricingType: true,
            deliveryType: true,
            estimatedDeliveryTime: true,
            requirementsFromCustomer: true,
            thumbnail: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        customer: {
          select: {
            id: true,
            email: true,
            profile: { select: { firstName: true, lastName: true, avatar: true } },
          },
        },
        vendor: {
          select: {
            id: true,
            email: true,
            profile: { select: { firstName: true, lastName: true, avatar: true } },
          },
        },
        store: {
          select: { id: true, name: true, slug: true, isVerified: true, logo: true },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, fileName: true, fileUrl: true, fileType: true, fileSize: true, uploadedBy: true, createdAt: true },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            status: true,
            notes: true,
            createdAt: true,
            changer: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
          },
        },
        quotations: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            quotedPrice: true,
            estimatedDuration: true,
            notes: true,
            validUntil: true,
            status: true,
            vendorId: true,
            vendor: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
            acceptedAt: true,
            rejectedAt: true,
          },
        },
      },
    })

    if (!requestData) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
    }

    perf.markPrismaEnd(prismaPerfStart)
    const response = NextResponse.json({ request: requestData })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching admin service request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}
