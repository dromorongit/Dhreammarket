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
    if (!payload || payload.role !== 'CUSTOMER') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await getPrisma().serviceRequest.findUnique({
      where: { id },
      select: { customerId: true, status: true, vendorId: true },
    })

    if (!existing) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
    }

    if (existing.customerId !== payload.userId) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existing.status !== 'QUOTED') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'No quotation available to reject' }, { status: 400 })
    }

    const quotation = await getPrisma().serviceQuotation.findFirst({
      where: {
        serviceRequestId: id,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!quotation) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'No pending quotation found' }, { status: 404 })
    }

    await getPrisma().serviceQuotation.update({
      where: { id: quotation.id },
      data: { status: 'REJECTED', rejectedAt: new Date() },
    })

    await getPrisma().serviceRequest.update({
      where: { id },
      data: {
        status: 'DECLINED',
      },
    })

    await getPrisma().serviceRequestStatusHistory.create({
      data: {
        serviceRequestId: id,
        status: 'DECLINED',
        changedBy: payload.userId,
        notes: 'Quotation rejected by customer',
      },
    })

    await createNotification(
      existing.vendorId,
      NotificationType.QUOTE_REJECTED,
      'Quotation Rejected',
      `Your quotation for service request "${id}" has been rejected by the customer.`
    )

    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    return NextResponse.json({ message: 'Quotation rejected successfully' })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error rejecting quotation:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}
