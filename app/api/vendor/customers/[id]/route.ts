import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

function toTwoDecimals(value: number | null): number {
  return Number((value || 0).toFixed(2))
}

async function deriveCustomerStats(storeId: string, customerId: string) {
  const prisma = getPrisma()
  const [allStats, paidStats] = await Promise.all([
    prisma.order.groupBy({
      by: ['vendorCustomerId'],
      where: {
        vendorCustomer: { storeId, id: customerId },
        deletedAt: null,
      },
      _count: { id: true },
      _max: { createdAt: true },
    }),
    prisma.order.groupBy({
      by: ['vendorCustomerId'],
      where: {
        vendorCustomer: { storeId, id: customerId },
        status: { not: 'CANCELLED' },
        paymentStatus: 'PAID',
      },
      _sum: { total: true },
    }),
  ])

  const stat = allStats.find((s) => s.vendorCustomerId === customerId)
  const paid = paidStats.find((s) => s.vendorCustomerId === customerId)

  return {
    orderCount: stat?._count.id || 0,
    totalSpent: toTwoDecimals(paid?._sum.total || null),
    lastOrderAt: stat?._max.createdAt || null,
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup to view customers' },
        { status: 403 }
      )
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const customer = await getPrisma().vendorCustomer.findFirst({
      where: { id: params.id, storeId: store.id },
      select: {
        id: true, name: true, phone: true, email: true, tags: true, notes: true,
        firstChannel: true, createdAt: true, updatedAt: true,
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const stats = await deriveCustomerStats(store.id, customer.id)

    let lastOrderedItems: Array<{ productId: string; productName: string; quantity: number; unitPrice: number }> = []
    const latestOrder = await getPrisma().order.findFirst({
      where: { vendorCustomerId: customer.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    if (latestOrder) {
      const items = await getPrisma().orderItem.findMany({
        where: { orderId: latestOrder.id },
        include: { product: { select: { id: true, name: true } } },
      })
      lastOrderedItems = items.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.price,
      }))
    }

    return NextResponse.json({ customer: { ...customer, ...stats, lastOrderedItems } })
  } catch (error) {
    console.error('Error fetching vendor customer:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup to update customers' },
        { status: 403 }
      )
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const existing = await getPrisma().vendorCustomer.findFirst({
      where: { id: params.id, storeId: store.id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (body.phone !== undefined) {
      return NextResponse.json(
        { error: 'Phone changes are not allowed. Use a new customer record for a different phone number.' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
      }
      updateData.name = body.name.trim()
    }
    if (body.email !== undefined) {
      if (body.email === null) {
        updateData.email = null
      } else if (typeof body.email !== 'string' || !isValidEmail(body.email)) {
        return NextResponse.json({ error: 'email must be a valid email address' }, { status: 400 })
      } else {
        updateData.email = body.email.trim()
      }
    }
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags) || body.tags.some((t: any) => typeof t !== 'string')) {
        return NextResponse.json({ error: 'tags must be an array of strings' }, { status: 400 })
      }
      updateData.tags = body.tags
    }
    if (body.notes !== undefined) {
      if (body.notes === null) {
        updateData.notes = null
      } else if (typeof body.notes !== 'string') {
        return NextResponse.json({ error: 'notes must be a string' }, { status: 400 })
      } else {
        updateData.notes = body.notes
      }
    }

    const updated = await getPrisma().vendorCustomer.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, name: true, phone: true, email: true, tags: true, notes: true, firstChannel: true, createdAt: true, updatedAt: true },
    })

    return NextResponse.json({ customer: updated })
  } catch (error) {
    console.error('Error updating vendor customer:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    )
  }
}
