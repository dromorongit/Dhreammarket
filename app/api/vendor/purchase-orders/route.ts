import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import {
  getVendorPurchaseOrders,
  createPurchaseOrder,
} from '@/lib/supplier-procurement'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if vendor has completed onboarding (store and category)
    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { purchaseOrders: [], success: false, error: 'Complete store setup to view purchase orders' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const includeCancelled = searchParams.get('includeCancelled') === 'true'

    const purchaseOrders = await getVendorPurchaseOrders(payload.userId, includeCancelled)

    return NextResponse.json({
      success: true,
      purchaseOrders,
    })
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
        { error: 'Complete store setup to create purchase orders' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { supplierId, expectedArrivalDate, notes, items } = body

    if (!supplierId) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      )
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      )
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each item must have a valid productId and quantity' },
          { status: 400 }
        )
      }
    }

    const result = await createPurchaseOrder({
      supplierId,
      vendorId: payload.userId,
      expectedArrivalDate: expectedArrivalDate ? new Date(expectedArrivalDate) : undefined,
      notes,
      items,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      purchaseOrder: result.purchaseOrder,
    })
  } catch (error) {
    console.error('Error creating purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}