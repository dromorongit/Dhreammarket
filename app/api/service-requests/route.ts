import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'
import { PerformanceLogger } from '@/lib/performance'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)

    if (isNaN(page) || page < 1) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 })
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Invalid limit. Must be between 1 and 100' }, { status: 400 })
    }

    const skip = (page - 1) * limit
    const status = url.searchParams.get('status')
    const serviceId = url.searchParams.get('serviceId')
    const vendorId = url.searchParams.get('vendorId')
    const customerId = url.searchParams.get('customerId')
    const search = url.searchParams.get('search')

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

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (serviceId) {
      where.serviceId = serviceId
    }

    if (vendorId) {
      where.vendorId = vendorId
    }

    if (customerId) {
      where.customerId = customerId
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (payload) {
      if (payload.role === 'CUSTOMER') {
        where.customerId = payload.userId
      } else if (payload.role === 'VENDOR') {
        const store = await getPrisma().store.findUnique({
          where: { userId: payload.userId },
        })
        if (store) {
          where.OR = [
            { vendorId: payload.userId },
            { storeId: store.id },
          ]
        } else {
          where.vendorId = payload.userId
        }
      }
    }

    const [requests, total] = await Promise.all([
      getPrisma().serviceRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          service: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnail: true,
              startingPrice: true,
            },
          },
          customer: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          vendor: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
              isVerified: true,
            },
          },
          attachments: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              fileType: true,
              fileSize: true,
              createdAt: true,
            },
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              notes: true,
              createdAt: true,
              changer: {
                select: {
                  id: true,
                  profile: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
          quotations: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              quotedPrice: true,
              estimatedDuration: true,
              notes: true,
              validUntil: true,
              status: true,
              vendorId: true,
              vendor: {
                select: {
                  id: true,
                  profile: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      getPrisma().serviceRequest.count({ where }),
    ])
    perf.markPrismaEnd(prismaPerfStart)

    const totalPages = Math.ceil(total / limit)

    const response = NextResponse.json({
      requests,
      pagination: { page, limit, total, totalPages },
    })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching service requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'CUSTOMER') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { serviceId, title, description, preferredCompletionDate, preferredBudget } = body

    if (!serviceId) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 })
    }

    if (!title || !title.trim()) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (preferredCompletionDate) {
      const completionDate = new Date(preferredCompletionDate)
      if (isNaN(completionDate.getTime())) {
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return NextResponse.json({ error: 'Invalid preferred completion date' }, { status: 400 })
      }
    }

    if (preferredBudget !== undefined && preferredBudget !== '') {
      const budget = parseFloat(preferredBudget)
      if (isNaN(budget) || budget < 0) {
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return NextResponse.json({ error: 'Preferred budget must be a valid number' }, { status: 400 })
      }
    }

    const service = await getPrisma().service.findUnique({
      where: { id: serviceId },
      include: { store: { select: { id: true, userId: true } } },
    })

    if (!service) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (!service.isActive || service.status !== 'PUBLISHED') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service is not available' }, { status: 400 })
    }

    const referenceNumber = `SR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const serviceRequest = await getPrisma().serviceRequest.create({
      data: {
        referenceNumber,
        serviceId,
        customerId: payload.userId,
        vendorId: service.store.userId,
        storeId: service.store.id,
        title: title.trim(),
        description: description?.trim() || null,
        preferredCompletionDate: preferredCompletionDate ? new Date(preferredCompletionDate) : null,
        preferredBudget: preferredBudget !== undefined && preferredBudget !== '' ? parseFloat(preferredBudget) : null,
        status: 'PENDING',
      },
      include: {
        service: {
          select: { id: true, title: true, slug: true, thumbnail: true, startingPrice: true },
        },
        customer: {
          select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } },
        },
        vendor: {
          select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } },
        },
        store: {
          select: { id: true, name: true, slug: true, isVerified: true },
        },
      },
    })
    perf.markPrismaEnd(prismaPerfStart)

    await getPrisma().serviceRequestStatusHistory.create({
      data: {
        serviceRequestId: serviceRequest.id,
        status: 'PENDING',
        changedBy: payload.userId,
        notes: 'Request submitted',
      },
    })

    await createNotification(
      service.store.userId,
      NotificationType.SERVICE_REQUEST_CREATED,
      'New Service Request',
      `A new service request "${serviceRequest.title}" has been submitted for your service.`
    )

    await createNotification(
      payload.userId,
      NotificationType.SERVICE_REQUEST_CREATED,
      'Request Submitted',
      `Your service request "${serviceRequest.title}" has been submitted successfully.`
    )

    perf.log()
    return NextResponse.json({ request: serviceRequest }, { status: 201 })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error creating service request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}