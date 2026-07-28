import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'
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
    const token = request.cookies.get('token')?.value
    let payload = null
    if (token) {
      payload = await verifyToken(token)
    }

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

    if (payload) {
      const isCustomer = requestData.customerId === payload.userId
      const isVendor = requestData.vendorId === payload.userId
      const isAdmin = payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN'

      if (!isCustomer && !isVendor && !isAdmin) {
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
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
    console.error('Error fetching service request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const { id } = await params
    const token = request.cookies.get('token')?.value
    if (!token) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await getPrisma().serviceRequest.findUnique({
      where: { id },
      select: { customerId: true, vendorId: true, status: true },
    })

    if (!existing) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
    }

    const isCustomer = existing.customerId === payload.userId
    const isVendor = existing.vendorId === payload.userId
    const isAdmin = payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN'

    if (!isCustomer && !isVendor && !isAdmin) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, preferredCompletionDate } = body

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description.trim() || null
    if (preferredCompletionDate !== undefined) {
      updateData.preferredCompletionDate = preferredCompletionDate ? new Date(preferredCompletionDate) : null
    }

    const updated = await getPrisma().serviceRequest.update({
      where: { id },
      data: updateData,
      include: {
        service: { select: { id: true, title: true, slug: true, thumbnail: true, startingPrice: true } },
        customer: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        vendor: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } },
        store: { select: { id: true, name: true, slug: true, isVerified: true } },
      },
    })
    perf.markPrismaEnd(prismaPerfStart)

    await createNotification(
      existing.vendorId,
      NotificationType.SERVICE_REQUEST_CREATED,
      'Request Updated',
      `Service request "${updated.title}" has been updated by the customer.`
    )

    perf.log()
    return NextResponse.json({ request: updated })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error updating service request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const { id } = await params
    const token = request.cookies.get('token')?.value
    if (!token) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await getPrisma().serviceRequest.findUnique({
      where: { id },
      select: { customerId: true, vendorId: true, status: true },
    })

    if (!existing) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
    }

    const isCustomer = existing.customerId === payload.userId
    const isAdmin = payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN'

    if (!isCustomer && !isAdmin) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existing.status !== 'PENDING' && existing.status !== 'DECLINED' && existing.status !== 'CANCELLED') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Cannot delete a request that is already in progress' }, { status: 400 })
    }

    await getPrisma().serviceRequest.delete({ where: { id } })
    perf.markPrismaEnd(prismaPerfStart)

    perf.log()
    return NextResponse.json({ message: 'Service request deleted successfully' })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error deleting service request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}