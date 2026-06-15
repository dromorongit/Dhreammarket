import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'

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

    const user = await getPrisma().user.findUnique({
      where: { id: payload.userId },
      include: { profile: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error fetching profile:', error)
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

    const { firstName, lastName, phone, address } = await request.json()

    // Fetch current profile for beforeData
    const currentProfile = await getPrisma().profile.findUnique({
      where: { userId: payload.userId },
    })

    // Update user profile
    const profile = await getPrisma().profile.upsert({
      where: { userId: payload.userId },
      update: {
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        address: address || null,
      },
      create: {
        userId: payload.userId,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        address: address || null,
      },
    })

    // Create audit log for profile update
    const { beforeData, afterData } = captureBeforeAfter(
      currentProfile ? { firstName: currentProfile.firstName, lastName: currentProfile.lastName, phone: currentProfile.phone, address: currentProfile.address } : null,
      { firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone, address: profile.address }
    )
    createAuditLog({
      userId: payload.userId,
      userRole: payload.role || 'USER',
      action: 'PROFILE_UPDATED',
      entityType: 'USER',
      entityId: payload.userId,
      beforeData,
      afterData,
    }).catch(err => console.error('Failed to create audit log:', err))

    return NextResponse.json({ profile, message: 'Profile updated successfully' })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}