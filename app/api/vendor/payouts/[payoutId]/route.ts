import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { payoutId: string } }
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

    const { payoutId } = params
    const { status, reference, note, paidAt } = await request.json()

    // Validate payout exists
    const existingPayout = await getPrisma().vendorPayout.findUnique({
      where: { id: payoutId }
    })

    if (!existingPayout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }

    // Validate status if provided
    if (status && !['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be PENDING, PROCESSING, PAID, FAILED, or CANCELLED' },
        { status: 400 }
      )
    }

    // Update payout
    const updatedPayout = await getPrisma().vendorPayout.update({
      where: { id: payoutId },
      data: {
        status: status || undefined,
        reference: reference || undefined,
        note: note || undefined,
        paidAt: paidAt ? new Date(paidAt) : undefined,
        updatedAt: new Date()
      }
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
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const { payoutId } = params

    // Validate payout exists
    const existingPayout = await getPrisma().vendorPayout.findUnique({
      where: { id: payoutId }
    })

    if (!existingPayout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }

    // Delete payout
    await getPrisma().vendorPayout.delete({
      where: { id: payoutId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vendor payout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}