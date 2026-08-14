import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import {
  updateSupplier,
  disableSupplier,
  getSupplierById,
  calculateSupplierPerformance,
} from '@/lib/supplier-procurement'

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

    // Check if vendor has completed onboarding (store and category)
    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup to view suppliers' },
        { status: 403 }
      )
    }

    const supplier = await getSupplierById(params.id, payload.userId)

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const performance = await calculateSupplierPerformance(supplier.id)

    return NextResponse.json({
      success: true,
      supplier: {
        ...supplier,
        performance,
      },
    })
  } catch (error) {
    console.error('Error fetching supplier:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier' },
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
        { error: 'Complete store setup to manage suppliers' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, ...data } = body

    if (action === 'disable' || action === 'enable') {
      const result = await disableSupplier(params.id, action === 'disable', payload.userId)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: result.error?.includes('Forbidden') ? 403 : 400 })
      }
      return NextResponse.json({ success: true })
    }

    const result = await updateSupplier(params.id, data, payload.userId)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.error?.includes('Forbidden') ? 403 : 400 })
    }

    return NextResponse.json({
      success: true,
      supplier: result.supplier,
    })
  } catch (error) {
    console.error('Error updating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    )
  }
}