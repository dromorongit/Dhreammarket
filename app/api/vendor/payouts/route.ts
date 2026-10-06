import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken, type VerifyTokenOutcome } from '@/lib/auth-middleware'
import { requireAdmin, requireSuperAdmin } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated || outcome.role === 'CUSTOMER' || outcome.role === 'INFLUENCER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const { searchParams } = new URL(request.url)
    const requestedVendorId = searchParams.get('vendorId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const isAdmin = payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN'
    const where: any = {}
    if (status) where.status = status

    if (isAdmin) {
      if (requestedVendorId) {
        where.vendorId = requestedVendorId
      }
    } else if (payload.role === 'VENDOR') {
      const store = await getPrisma().store.findUnique({
        where: { userId: payload.userId },
      })
      if (!store) {
        return NextResponse.json({
          payouts: [],
          pagination: { total: 0, limit, offset, hasMore: false },
        })
      }
      where.storeId = store.id
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payouts = await getPrisma().vendorPayout.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    const total = await getPrisma().vendorPayout.count({ where })

    return NextResponse.json({
      payouts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('Error fetching vendor payouts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof Response) {
      return authResult
    }

    const { vendorId, storeId, amount, reference, note } = await request.json()

    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        { error: 'Amount must be a positive finite number' },
        { status: 400 }
      )
    }

    const [vendor, store] = await Promise.all([
      getPrisma().user.findUnique({ where: { id: vendorId, role: 'VENDOR' } }),
      getPrisma().store.findUnique({ where: { id: storeId } }),
    ])

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const eligibleEarnings = await getVendorUnpaidEligibleEarnings(vendorId)

    if (amount > eligibleEarnings) {
      return NextResponse.json(
        {
          error:
            'Amount exceeds vendor available unpaid eligible earnings',
          availableEarnings: eligibleEarnings,
        },
        { status: 400 }
      )
    }

    const payout = await getPrisma().vendorPayout.create({
      data: {
        vendorId,
        storeId,
        amount,
        status: 'PENDING',
        reference,
        note,
      },
      include: {
        vendor: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    await createAuditLog({
      userId: authResult.userId,
      userRole: authResult.role,
      action: 'PAYOUT_CREATED',
      entityType: 'VENDOR_PAYOUT_METHOD',
      entityId: payout.id,
      afterData: payout,
    })

    return NextResponse.json(payout, { status: 201 })
  } catch (error) {
    console.error('Error creating vendor payout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { payoutId: string } }
) {
  try {
    const authResult = await requireAdmin()
    if (authResult instanceof Response) {
      return authResult
    }

    const { payoutId } = params
    const body = await request.json()
    const { status, reference, note, paidAt } = body

    const existingPayout = await getPrisma().vendorPayout.findUnique({
      where: { id: payoutId },
    })

    if (!existingPayout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }

    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['PROCESSING', 'PAID', 'FAILED', 'CANCELLED'],
      PROCESSING: ['PAID', 'FAILED'],
    }

    if (status) {
      if (
        !['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'].includes(
          status
        )
      ) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }

      const currentStatus = existingPayout.status
      if (status !== currentStatus) {
        const permitted = allowedTransitions[currentStatus] || []
        if (!permitted.includes(status)) {
          return NextResponse.json(
            {
              error:
                `Disallowed status transition from ${currentStatus} to ${status}`,
            },
            { status: 400 }
          )
        }
      }
    }

    if (body.hasOwnProperty('paidAt') || paidAt !== undefined) {
      if (status !== 'PAID') {
        return NextResponse.json(
          { error: 'paidAt may only be set when status is PAID' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {
      ...(reference !== undefined && { reference }),
      ...(note !== undefined && { note }),
      ...(status && { status }),
      updatedAt: new Date(),
    }

    if (status === 'PAID') {
      updateData.paidAt = paidAt ? new Date(paidAt) : new Date()
    }

    const updatedPayout = await getPrisma().vendorPayout.update({
      where: { id: payoutId },
      data: updateData,
    })

    await createAuditLog({
      userId: authResult.userId,
      userRole: authResult.role,
      action: 'PAYOUT_STATUS_UPDATED',
      entityType: 'VENDOR_PAYOUT_METHOD',
      entityId: payoutId,
      beforeData: existingPayout,
      afterData: updatedPayout,
    })

    return NextResponse.json(updatedPayout)
  } catch (error) {
    console.error('Error updating vendor payout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { payoutId: string } }
) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof Response) {
      return authResult
    }

    const { payoutId } = params

    const existingPayout = await getPrisma().vendorPayout.findUnique({
      where: { id: payoutId },
    })

    if (!existingPayout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }

    if (!['PENDING', 'CANCELLED'].includes(existingPayout.status)) {
      return NextResponse.json(
        {
          error:
            'Only PENDING or CANCELLED payouts can be deleted',
          currentStatus: existingPayout.status,
        },
        { status: 400 }
      )
    }

    await getPrisma().vendorPayout.delete({
      where: { id: payoutId },
    })

    await createAuditLog({
      userId: authResult.userId,
      userRole: authResult.role,
      action: 'PAYOUT_DELETED',
      entityType: 'VENDOR_PAYOUT_METHOD',
      entityId: payoutId,
      beforeData: existingPayout,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vendor payout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getVendorUnpaidEligibleEarnings(vendorId: string) {
  const store = await getPrisma().store.findUnique({
    where: { userId: vendorId },
    select: { id: true },
  })

  if (!store) {
    return 0
  }

  const result = await getPrisma().orderItem.aggregate({
    where: {
      product: {
        storeId: store.id,
      },
      order: {
        paymentStatus: 'PAID',
        status: {
          in: ['DELIVERED', 'COMPLETED'],
        },
      },
    },
    _sum: {
      vendorEarnings: true,
    },
  })

  const eligibleEarnings = result._sum?.vendorEarnings || 0

  const pendingPayouts = await getPrisma().vendorPayout.findMany({
    where: {
      vendorId,
      status: {
        in: ['PENDING', 'PROCESSING', 'PAID'],
      },
    },
    select: {
      amount: true,
    },
  })

  const alreadyPaidOut = pendingPayouts.reduce(
    (sum, payout) => sum + payout.amount,
    0
  )

  return Math.max(eligibleEarnings - alreadyPaidOut, 0)
}
