import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const wishlist = await getPrisma().wishlist.findUnique({
      where: { userId: payload.userId },
    })

    if (!wishlist) {
      const newWishlist = await getPrisma().wishlist.create({
        data: { userId: payload.userId },
      })
      return NextResponse.json({
        notificationPreferences: newWishlist.notificationPreferences || {},
        privacyPreferences: newWishlist.privacyPreferences || {},
        recommendationPreferences: newWishlist.recommendationPreferences || {},
      })
    }

    return NextResponse.json({
      notificationPreferences: wishlist.notificationPreferences || {},
      privacyPreferences: wishlist.privacyPreferences || {},
      recommendationPreferences: wishlist.recommendationPreferences || {},
    })
  } catch (error) {
    console.error('Error fetching wishlist preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationPreferences, privacyPreferences, recommendationPreferences } = body

    const prisma = getPrisma()

    let wishlist = await prisma.wishlist.findUnique({
      where: { userId: payload.userId },
    })

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: {
          userId: payload.userId,
          notificationPreferences: notificationPreferences || {},
          privacyPreferences: privacyPreferences || {},
          recommendationPreferences: recommendationPreferences || {},
        },
      })
    } else {
      wishlist = await prisma.wishlist.update({
        where: { userId: payload.userId },
        data: {
          ...(notificationPreferences !== undefined && { notificationPreferences: notificationPreferences as any }),
          ...(privacyPreferences !== undefined && { privacyPreferences: privacyPreferences as any }),
          ...(recommendationPreferences !== undefined && { recommendationPreferences: recommendationPreferences as any }),
        },
      })
    }

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'PROFILE_UPDATED',
      entityType: 'USER',
      entityId: payload.userId,
      afterData: { wishlistId: wishlist.id, action: 'preferences_updated' },
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({
      notificationPreferences: wishlist.notificationPreferences || {},
      privacyPreferences: wishlist.privacyPreferences || {},
      recommendationPreferences: wishlist.recommendationPreferences || {},
    })
  } catch (error) {
    console.error('Error updating wishlist preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
