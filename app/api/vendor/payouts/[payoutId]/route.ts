import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin, requireSuperAdmin } from '@/lib/adminAuth'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

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

    if (paidAt !== undefined) {
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
