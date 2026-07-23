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

    const body = await request.json()
    const {
      firstName,
      lastName,
      phone,
      address,
      avatar,
      darkMode,
      language,
      currency,
      timezone,
      emailNotifications,
      orderNotifications,
      promotionalNotifications,
      systemNotifications,
    } = body

    const currentProfile = await getPrisma().profile.findUnique({
      where: { userId: payload.userId },
    })

    const profile = await getPrisma().profile.upsert({
      where: { userId: payload.userId },
      update: {
        ...(firstName !== undefined ? { firstName: firstName || null } : {}),
        ...(lastName !== undefined ? { lastName: lastName || null } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(address !== undefined ? { address: address } : {}),
        ...(avatar !== undefined ? { avatar: avatar || null } : {}),
        ...(darkMode !== undefined ? { darkMode } : {}),
        ...(language !== undefined ? { language: language || null } : {}),
        ...(currency !== undefined ? { currency: currency || null } : {}),
        ...(timezone !== undefined ? { timezone: timezone || null } : {}),
        ...(emailNotifications !== undefined ? { emailNotifications } : {}),
        ...(orderNotifications !== undefined ? { orderNotifications } : {}),
        ...(promotionalNotifications !== undefined ? { promotionalNotifications } : {}),
        ...(systemNotifications !== undefined ? { systemNotifications } : {}),
      },
      create: {
        userId: payload.userId,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        address: address || null,
        avatar: avatar || null,
        darkMode: darkMode ?? false,
        language: language ?? 'en',
        currency: currency ?? 'GHS',
        timezone: timezone ?? 'Africa/Accra',
        emailNotifications: emailNotifications ?? true,
        orderNotifications: orderNotifications ?? true,
        promotionalNotifications: promotionalNotifications ?? false,
        systemNotifications: systemNotifications ?? true,
      },
    })

    const { beforeData, afterData } = captureBeforeAfter(
      currentProfile
        ? {
            firstName: currentProfile.firstName,
            lastName: currentProfile.lastName,
            phone: currentProfile.phone,
            address: currentProfile.address,
            avatar: currentProfile.avatar,
            darkMode: currentProfile.darkMode,
            language: currentProfile.language,
            currency: currentProfile.currency,
            timezone: currentProfile.timezone,
            emailNotifications: currentProfile.emailNotifications,
            orderNotifications: currentProfile.orderNotifications,
            promotionalNotifications: currentProfile.promotionalNotifications,
            systemNotifications: currentProfile.systemNotifications,
          }
        : null,
      {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        address: profile.address,
        avatar: profile.avatar,
        darkMode: profile.darkMode,
        language: profile.language,
        currency: profile.currency,
        timezone: profile.timezone,
        emailNotifications: profile.emailNotifications,
        orderNotifications: profile.orderNotifications,
        promotionalNotifications: profile.promotionalNotifications,
        systemNotifications: profile.systemNotifications,
      }
    )
    createAuditLog({
      userId: payload.userId,
      userRole: payload.role || 'USER',
      action: 'PROFILE_UPDATED',
      entityType: 'USER',
      entityId: payload.userId,
      beforeData,
      afterData,
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ profile, message: 'Profile updated successfully' })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}