import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { getPrisma } from '@/lib/prisma'
import { updatePurchaseOrderStatus, linkPurchaseOrderToRestock } from '@/lib/supplier-procurement'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const purchaseOrder = await getPrisma().purchaseOrder.findUnique({
      where: { id: params.id },
      include: {
        supplier: true,
        items: {
          include: { product: { select: { name: true, stock: true } } },
        },
        restockOrders: true,
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (purchaseOrder.vendorId !== payload.userId) {
      return NextResponse.json({ error: 'Unauthorized: Not your purchase order' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      purchaseOrder,
    })
  } catch (error) {
    console.error('Error fetching purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    )
  }
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
        { error: 'Complete store setup to update purchase orders' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status, linkToRestockOrderId } = body

    if (linkToRestockOrderId) {
      const result = await linkPurchaseOrderToRestock(params.id, linkToRestockOrderId, payload.userId)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      )
    }

    const result = await updatePurchaseOrderStatus(params.id, payload.userId, status)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      purchaseOrder: result.purchaseOrder,
    })
  } catch (error) {
    console.error('Error updating purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to update purchase order' },
      { status: 500 }
    )
  }
}