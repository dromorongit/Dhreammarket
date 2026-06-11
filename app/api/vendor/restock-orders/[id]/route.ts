import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { updateRestockOrderStatus } from '@/lib/restock-procurement'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'

export const dynamic = 'force-dynamic'

const VALID_RESTOCK_TRANSITIONS: Record<string, string[]> = {
  ORDERED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup to update restock orders' },
        { status: 403 }
      )
    }

    const { id: restockOrderId } = params
    const body = await request.json()
    const { status, actualArrivalDate } = body

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      )
    }

    const result = await updateRestockOrderStatus(
      restockOrderId,
      payload.userId,
      status,
      actualArrivalDate ? new Date(actualArrivalDate) : undefined
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const eventMap: Record<string, 'PROCUREMENT_SHIPPED' | 'PROCUREMENT_ARRIVED' | 'PROCUREMENT_INVENTORY_RECEIVED'> = {
      SHIPPED: 'PROCUREMENT_SHIPPED',
      ARRIVED: 'PROCUREMENT_ARRIVED',
      RECEIVED: 'PROCUREMENT_INVENTORY_RECEIVED',
    }

    if (eventMap[status] && result.restockOrder) {
      await recordFulfillmentEvent(
        restockOrderId,
        eventMap[status],
        payload.userId,
        {
          productName: result.restockOrder.productName,
          vendorId: payload.userId,
          description: `Restock order status updated to ${status}`,
        }
      ).catch(err => console.error('Failed to record restock event:', err))
    }

    return NextResponse.json({
      success: true,
      restockOrder: result.restockOrder,
    })
  } catch (error) {
    console.error('Error updating restock order:', error)
    return NextResponse.json(
      { error: 'Failed to update restock order' },
      { status: 500 }
    )
  }
}