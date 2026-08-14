import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  disableSupplier,
  calculateSupplierPerformance,
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
        { suppliers: [], success: false, error: 'Complete store setup to view suppliers' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const includeDisabled = searchParams.get('includeDisabled') === 'true'

    const suppliers = await getSuppliers(payload.userId, includeDisabled)

    const suppliersWithPerformance = await Promise.all(
      suppliers.map(async s => ({
        ...s,
        performance: await calculateSupplierPerformance(s.id),
      }))
    )

    return NextResponse.json({
      success: true,
      suppliers: suppliersWithPerformance,
    })
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
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
        { error: 'Complete store setup to manage suppliers' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { companyName, contactPerson, email, phone, address, country, notes, status } = body

    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    const result = await createSupplier({
      companyName,
      contactPerson,
      email,
      phone,
      address,
      country,
      notes,
      status,
      vendorId: payload.userId,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      supplier: result.supplier,
    })
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    )
  }
}