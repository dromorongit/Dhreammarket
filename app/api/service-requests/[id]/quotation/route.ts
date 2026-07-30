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

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    if (!payload || (payload.role !== 'VENDOR' && payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN')) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await getPrisma().serviceRequest.findUnique({
      where: { id },
      select: { vendorId: true, status: true, serviceId: true },
    })

    if (!existing) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
    }

    if (existing.vendorId !== payload.userId && payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existing.status !== 'PENDING' && existing.status !== 'UNDER_REVIEW') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Cannot send quotation for this request status' }, { status: 400 })
    }

    const body = await request.json()
    const { quotedPrice, estimatedDuration, notes, validityDate } = body

    if (quotedPrice === undefined || quotedPrice === null) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Quoted price is required' }, { status: 400 })
    }

    const parsedPrice = parseFloat(quotedPrice)
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Quoted price must be a positive number' }, { status: 400 })
    }

    if (!validityDate) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Validity date is required' }, { status: 400 })
    }

    const validUntil = new Date(validityDate)
    if (isNaN(validUntil.getTime()) || validUntil <= new Date()) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Validity date must be a future date' }, { status: 400 })
    }

    const quotation = await getPrisma().serviceQuotation.create({
      data: {
        serviceRequestId: id,
        vendorId: payload.userId,
        quotedPrice: parsedPrice,
        estimatedDuration: estimatedDuration?.trim() || null,
        notes: notes?.trim() || null,
        validUntil: validUntil,
        status: 'PENDING',
      },
      include: {
        vendor: { select: { id: true, profile: { select: { firstName: true, lastName: true } } } },
        serviceRequest: { select: { id: true, title: true, customerId: true } },
      },
    })

    await getPrisma().serviceRequest.update({
      where: { id },
      data: {
        status: 'QUOTED',
        quotedPrice: parsedPrice,
        estimatedDuration: estimatedDuration?.trim() || null,
        quotationNotes: notes?.trim() || null,
        quotationValidUntil: validUntil,
      },
    })

    await getPrisma().serviceRequestStatusHistory.create({
      data: {
        serviceRequestId: id,
        status: 'QUOTED',
        changedBy: payload.userId,
        notes: `Quotation sent: $${quotedPrice}`,
      },
    })

    await createNotification(
      existing.vendorId === payload.userId ? existing.vendorId : existing.vendorId,
      NotificationType.QUOTE_SENT,
      'Quotation Sent',
      `A quotation has been sent for service request "${existing.serviceId}".`
    )

    const customerRequest = await getPrisma().serviceRequest.findUnique({
      where: { id },
      select: { customerId: true },
    })

    if (customerRequest) {
      await createNotification(
        customerRequest.customerId,
        NotificationType.QUOTE_SENT,
        'Quotation Received',
        `A vendor has sent a quotation for your service request.`
      )
    }

    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    return NextResponse.json({ quotation }, { status: 201 })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error sending quotation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}