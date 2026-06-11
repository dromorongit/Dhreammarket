import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { getPrisma } from '@/lib/prisma'
import { createRestockOrder, getVendorRestockOrders, updateRestockOrderStatus, checkOverdueRestockOrders } from '@/lib/restock-procurement'
import { getProductDemandMetrics } from '@/lib/demand-forecast'

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

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({ 
        restockOrders: [], 
        error: 'Complete store setup to view restock orders' 
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const includeCancelled = searchParams.get('includeCancelled') === 'true'

    const restockOrders = await getVendorRestockOrders(payload.userId, includeCancelled)

    return NextResponse.json({
      success: true,
      restockOrders,
    })
  } catch (error) {
    console.error('Error fetching restock orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch restock orders' },
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
        { error: 'Complete store setup to create restock orders' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { productId, quantityOrdered, expectedArrivalDate, notes } = body

    if (!productId || !quantityOrdered) {
      return NextResponse.json(
        { error: 'Product ID and quantity are required' },
        { status: 400 }
      )
    }

    if (typeof quantityOrdered !== 'number' || quantityOrdered <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be a positive number' },
        { status: 400 }
      )
    }

    const result = await createRestockOrder(
      productId,
      payload.userId,
      quantityOrdered,
      expectedArrivalDate ? new Date(expectedArrivalDate) : undefined,
      notes
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    checkOverdueRestockOrders(payload.userId).catch(err => 
      console.error('Failed to check overdue restock orders:', err)
    )

    return NextResponse.json({
      success: true,
      restockOrder: result.restockOrder,
    })
  } catch (error) {
    console.error('Error creating restock order:', error)
    return NextResponse.json(
      { error: 'Failed to create restock order' },
      { status: 500 }
    )
  }
}