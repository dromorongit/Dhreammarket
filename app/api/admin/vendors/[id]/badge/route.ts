import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'
import { VendorBadgeTier } from '@prisma/client'

const prisma = getPrisma()

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const adminUser = authCheck
    const { id } = await params
    const body = await request.json()
    const { action, badgeTier } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    const store = await prisma.store.findUnique({
      where: { id },
    })

    if (!store) {
      return NextResponse.json({ error: 'Vendor store not found' }, { status: 404 })
    }

    let updatedStore

    switch (action) {
      case 'assign_badge':
      case 'update_badge': {
        const validTiers = ['TRUSTED', 'PREMIUM', 'PLATINUM']
        if (!badgeTier || !validTiers.includes(badgeTier)) {
          return NextResponse.json({ error: 'Valid badge tier (TRUSTED, PREMIUM, or PLATINUM) is required' }, { status: 400 })
        }

        const { beforeData, afterData } = captureBeforeAfter(
          { badgeTier: store.badgeTier },
          { badgeTier }
        )

        updatedStore = await prisma.store.update({
          where: { id },
          data: { badgeTier: badgeTier as VendorBadgeTier },
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

        const auditAction = store.badgeTier ? 'VENDOR_BADGE_UPDATED' : 'VENDOR_BADGE_ASSIGNED'
        await createAuditLog({
          userId: adminUser.userId,
          userRole: adminUser.role,
          action: auditAction,
          entityType: 'VENDOR',
          entityId: id,
          beforeData,
          afterData,
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
        })
        break
      }

      case 'remove_badge': {
        const { beforeData, afterData } = captureBeforeAfter(
          { badgeTier: store.badgeTier },
          { badgeTier: null }
        )

        updatedStore = await prisma.store.update({
          where: { id },
          data: { badgeTier: null },
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

        await createAuditLog({
          userId: adminUser.userId,
          userRole: adminUser.role,
          action: 'VENDOR_BADGE_REMOVED',
          entityType: 'VENDOR',
          entityId: id,
          beforeData,
          afterData,
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
        })
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use: assign_badge, update_badge, or remove_badge' }, { status: 400 })
    }

    const vendor = {
      id: updatedStore!.id,
      name: updatedStore!.name,
      description: updatedStore!.description,
      isVerified: updatedStore!.isVerified,
      isFeatured: updatedStore!.isFeatured,
      badgeTier: updatedStore!.badgeTier,
      featuredUntil: updatedStore!.featuredUntil ? updatedStore!.featuredUntil.toISOString() : null,
      createdAt: updatedStore!.user.createdAt,
      user: {
        id: updatedStore!.user.id,
        email: updatedStore!.user.email,
        role: updatedStore!.user.role,
        createdAt: updatedStore!.user.createdAt,
      },
      _count: {
        products: updatedStore!._count.products,
      },
    }

    return NextResponse.json({ vendor })
  } catch (error) {
    console.error('Vendor badge management error:', error)
    return NextResponse.json({ error: 'Failed to update vendor badge' }, { status: 500 })
  }
}