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
    if (!payload) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await getPrisma().serviceRequest.findUnique({
      where: { id },
      select: { customerId: true, vendorId: true, status: true, title: true, referenceNumber: true },
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
    const { status, notes } = body

    const validTransitions: Record<string, string[]> = {
      PENDING: ['UNDER_REVIEW', 'CANCELLED'],
      UNDER_REVIEW: ['QUOTED', 'DECLINED', 'CANCELLED'],
      QUOTED: ['ACCEPTED', 'DECLINED', 'CANCELLED'],
      ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      DECLINED: ['UNDER_REVIEW'],
    }

    const allowedTransitions = validTransitions[existing.status]
    if (!allowedTransitions || !allowedTransitions.includes(status)) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: `Cannot transition from ${existing.status} to ${status}` }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { status }
    if (status === 'CANCELLED') updateData.cancelledAt = new Date()
    if (status === 'COMPLETED') updateData.completedAt = new Date()

    await getPrisma().serviceRequest.update({
      where: { id },
      data: updateData,
    })

    await getPrisma().serviceRequestStatusHistory.create({
      data: {
        serviceRequestId: id,
        status: status as any,
        changedBy: payload.userId,
        notes: notes?.trim() || null,
      },
    })

    const notificationMap: Record<string, NotificationType> = {
      UNDER_REVIEW: NotificationType.SERVICE_REQUEST_CREATED,
      QUOTED: NotificationType.QUOTE_SENT,
      ACCEPTED: NotificationType.QUOTE_ACCEPTED,
      DECLINED: NotificationType.QUOTE_REJECTED,
      IN_PROGRESS: NotificationType.PROJECT_STARTED,
      COMPLETED: NotificationType.PROJECT_COMPLETED,
      CANCELLED: NotificationType.QUOTE_REJECTED,
    }

    const otherPartyId = existing.customerId === payload.userId ? existing.vendorId : existing.customerId
    if (otherPartyId && notificationMap[status]) {
      await createNotification(
        otherPartyId,
        notificationMap[status],
        `Request ${status.replace('_', ' ')}`,
        `Service request "${existing.referenceNumber || existing.title}" status has been updated to ${status}.${notes ? ' Notes: ' + notes : ''}`
      )
    }

    await createNotification(
      payload.userId,
      notificationMap[status] || NotificationType.SERVICE_REQUEST_CREATED,
      `Request ${status.replace('_', ' ')}`,
      `You have updated the service request status to ${status}.`
    )

    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    return NextResponse.json({ message: 'Status updated successfully' })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error updating status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}