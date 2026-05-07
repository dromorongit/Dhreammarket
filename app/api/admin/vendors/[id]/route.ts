import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
const prisma = getPrisma()
import { requireAdmin } from '@/lib/adminAuth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

// GET vendor by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id } = await params

    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
        products: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { reviews: true },
            },
          },
        },
        _count: {
          select: { products: true },
        },
      },
    })

    if (!store) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Get orders for this vendor's products
    const vendorOrders = await prisma.orderItem.findMany({
      where: {
        product: { storeId: id },
      },
      include: {
        order: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      store,
      vendorOrders,
    })
  } catch (error) {
    console.error('Admin vendor get error:', error)
    return NextResponse.json({ error: 'Failed to fetch vendor' }, { status: 500 })
  }
}

// PATCH - Verify or suspend vendor
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id } = await params
    const body = await request.json()
    const { action, value, duration } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    const store = await prisma.store.findUnique({
      where: { id },
    })

    if (!store) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    let updatedStore

    switch (action) {
      case 'verify':
        // Verify the vendor (set isVerified to true)
        updatedStore = await prisma.store.update({
          where: { id },
          data: { isVerified: value === true },
        })
        break

      case 'disable':
        // Disable vendor by setting their role to CUSTOMER (removes vendor privileges)
        updatedStore = await prisma.store.update({
          where: { id },
          data: { isVerified: false, isFeatured: false, featuredUntil: null },
        })
        
        // Also update the user role
        await prisma.user.update({
          where: { id: store.userId },
          data: { role: 'CUSTOMER' },
        })
        break

      case 'enable':
        // Re-enable vendor by restoring their role
        updatedStore = await prisma.store.update({
          where: { id },
          data: { isVerified: true },
        })
        
        await prisma.user.update({
          where: { id: store.userId },
          data: { role: 'VENDOR' },
        })
        break

      case 'feature':
        // Feature the vendor for a specified duration
        if (!value || value !== true) {
          // Unfeature the vendor
          updatedStore = await prisma.store.update({
            where: { id },
            data: { isFeatured: false, featuredUntil: null },
          })
        } else {
          // Calculate featuredUntil date
          let featuredUntil: Date | null = null
          if (duration) {
            const days = parseInt(duration)
            if (!isNaN(days) && days > 0) {
              featuredUntil = new Date()
              featuredUntil.setDate(featuredUntil.getDate() + days)
            }
          }
          
          updatedStore = await prisma.store.update({
            where: { id },
            data: { isFeatured: true, featuredUntil },
          })
        }
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ store: updatedStore })
  } catch (error) {
    console.error('Admin vendor patch error:', error)
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 })
  }
}