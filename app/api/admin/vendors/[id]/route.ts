import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'

const prisma = getPrisma()

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
               select: { productReviews: true },
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

    const adminUser = authCheck
    const { id } = await params
    const body = await request.json()
    const { action, value, duration, badgeTier } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    // Verify store exists before any update
    const existingStore = await prisma.store.findUnique({
      where: { id },
      include: { user: true }
    })
    
    if (!existingStore) {
      return NextResponse.json({ error: 'Vendor store not found' }, { status: 404 })
    }

    // Update store with necessary includes to return vendor format
    let updatedStore

    switch (action) {
case 'verify':
         // Verify the vendor (set isVerified to true) and optionally set badgeTier
         updatedStore = await prisma.store.update({
           where: { id },
           data: { 
             isVerified: value === true,
             badgeTier: badgeTier || null,
           },
           include: {
             user: {
               select: {
                 id: true,
                 email: true,
                 role: true,
                 createdAt: true,
               },
             },
             _count: {
               select: { products: true },
             },
           },
         })
         // Create audit log for vendor approval
         await createAuditLog({
           userId: adminUser.userId,
           userRole: adminUser.role,
           action: 'VENDOR_APPROVED',
           entityType: 'VENDOR',
           entityId: id,
           beforeData: { isVerified: existingStore.isVerified, isFeatured: existingStore.isFeatured, badgeTier: existingStore.badgeTier },
           afterData: { isVerified: updatedStore.isVerified, isFeatured: updatedStore.isFeatured, badgeTier: updatedStore.badgeTier },
           ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
         })
         break

      case 'revoke':
        // Revoke the vendor (set isVerified to false)
        updatedStore = await prisma.store.update({
          where: { id },
          data: { isVerified: false },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
              },
            },
            _count: {
              select: { products: true },
            },
          },
        })
        // Create audit log for vendor rejection
        await createAuditLog({
          userId: adminUser.userId,
          userRole: adminUser.role,
          action: 'VENDOR_REJECTED',
          entityType: 'VENDOR',
          entityId: id,
          beforeData: { isVerified: existingStore.isVerified, isFeatured: existingStore.isFeatured },
          afterData: { isVerified: updatedStore.isVerified, isFeatured: updatedStore.isFeatured },
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
        })
        break

      case 'disable':
        // Disable vendor by setting isVerified and isFeatured to false
        const { beforeData, afterData } = captureBeforeAfter(
          { isVerified: existingStore.isVerified, isFeatured: existingStore.isFeatured },
          { isVerified: false, isFeatured: false }
        )
        updatedStore = await prisma.store.update({
          where: { id },
          data: { isVerified: false, isFeatured: false, featuredUntil: null },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
              },
            },
            _count: {
              select: { products: true },
            },
          },
        })
        // Also update the user role to CUSTOMER
        await prisma.user.update({
          where: { id: updatedStore.userId },
          data: { role: 'CUSTOMER' },
        })
        // Create audit log for vendor rejection
        await createAuditLog({
          userId: adminUser.userId,
          userRole: adminUser.role,
          action: 'VENDOR_REJECTED',
          entityType: 'VENDOR',
          entityId: id,
          beforeData,
          afterData,
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
        })
        break

      case 'enable':
        // Re-enable vendor by setting isVerified to true
        updatedStore = await prisma.store.update({
          where: { id },
          data: { isVerified: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                createdAt: true,
              },
            },
            _count: {
              select: { products: true },
            },
          },
        })
        // Also update the user role to VENDOR
        await prisma.user.update({
          where: { id: updatedStore.userId },
          data: { role: 'VENDOR' },
        })
        // Create audit log for vendor approval
        await createAuditLog({
          userId: adminUser.userId,
          userRole: adminUser.role,
          action: 'VENDOR_APPROVED',
          entityType: 'VENDOR',
          entityId: id,
          beforeData: { isVerified: existingStore.isVerified },
          afterData: { isVerified: updatedStore.isVerified },
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
        })
        break

      case 'feature':
        // Feature the vendor for a specified duration
        if (!value || value !== true) {
          // Unfeature the vendor
          updatedStore = await prisma.store.update({
            where: { id },
            data: { isFeatured: false, featuredUntil: null },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  role: true,
                  createdAt: true,
                },
              },
              _count: {
                select: { products: true },
              },
            },
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
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  role: true,
                  createdAt: true,
                },
              },
              _count: {
                select: { products: true },
              },
            },
          })
        }
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (!updatedStore) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Transform store to vendor format expected by frontend
    const vendor = {
      id: updatedStore.id,
      name: updatedStore.name,
      description: updatedStore.description,
      isVerified: updatedStore.isVerified,
      isFeatured: updatedStore.isFeatured,
      badgeTier: updatedStore.badgeTier,
      featuredUntil: updatedStore.featuredUntil ? updatedStore.featuredUntil.toISOString() : null,
      createdAt: updatedStore.user.createdAt,
      user: {
        id: updatedStore.user.id,
        email: updatedStore.user.email,
        role: updatedStore.user.role,
        createdAt: updatedStore.user.createdAt,
      },
      _count: {
        products: updatedStore._count.products,
      },
    }

    return NextResponse.json({ vendor })
  } catch (error) {
    console.error('Admin vendor patch error:', error)
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 })
  }
}

// DELETE - Delete a vendor
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const { id } = await params

    // Check if store exists
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        user: true,
      },
    })

    if (!store) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Delete the store (this will cascade to products, etc. due to onDelete: Cascade)
    await prisma.store.delete({
      where: { id },
    })

    // Also update the user role to CUSTOMER (or delete the user? We'll keep the user but change role)
    // This prevents orphaned users
    await prisma.user.update({
      where: { id: store.userId },
      data: { role: 'CUSTOMER' },
    })

    return NextResponse.json({ success: true, message: 'Vendor deleted successfully' })
  } catch (error) {
    console.error('Admin vendor delete error:', error)
    return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 })
  }
}