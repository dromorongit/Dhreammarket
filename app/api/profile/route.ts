import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { sanitizeUserContent } from '@/lib/sanitize'
import { sanitizePhoneNumber } from '@/lib/phone'
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

    if (typeof firstName !== 'undefined' && typeof firstName !== 'string') {
      return NextResponse.json({ error: 'Invalid first name' }, { status: 400 })
    }
    if (typeof lastName !== 'undefined' && typeof lastName !== 'string') {
      return NextResponse.json({ error: 'Invalid last name' }, { status: 400 })
    }
    if (typeof phone !== 'undefined' && typeof phone !== 'string') {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }
    if (typeof address !== 'undefined' && typeof address !== 'string') {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }
    if (typeof avatar !== 'undefined' && typeof avatar !== 'string') {
      return NextResponse.json({ error: 'Invalid avatar' }, { status: 400 })
    }
    if (typeof language !== 'undefined' && typeof language !== 'string') {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
    }
    if (typeof currency !== 'undefined' && typeof currency !== 'string') {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
    }
    if (typeof timezone !== 'undefined' && typeof timezone !== 'string') {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
    }
    if (typeof darkMode !== 'undefined' && typeof darkMode !== 'boolean') {
      return NextResponse.json({ error: 'Invalid darkMode value' }, { status: 400 })
    }
    if (typeof emailNotifications !== 'undefined' && typeof emailNotifications !== 'boolean') {
      return NextResponse.json({ error: 'Invalid emailNotifications value' }, { status: 400 })
    }
    if (typeof orderNotifications !== 'undefined' && typeof orderNotifications !== 'boolean') {
      return NextResponse.json({ error: 'Invalid orderNotifications value' }, { status: 400 })
    }
    if (typeof promotionalNotifications !== 'undefined' && typeof promotionalNotifications !== 'boolean') {
      return NextResponse.json({ error: 'Invalid promotionalNotifications value' }, { status: 400 })
    }
    if (typeof systemNotifications !== 'undefined' && typeof systemNotifications !== 'boolean') {
      return NextResponse.json({ error: 'Invalid systemNotifications value' }, { status: 400 })
    }

    const cleanFirstName = typeof firstName !== 'undefined' ? (typeof firstName === 'string' ? sanitizeUserContent(firstName, { maxLength: 50 }) || null : null) : undefined
    const cleanLastName = typeof lastName !== 'undefined' ? (typeof lastName === 'string' ? sanitizeUserContent(lastName, { maxLength: 50 }) || null : null) : undefined
    const cleanPhone = typeof phone !== 'undefined' ? (typeof phone === 'string' ? sanitizePhoneNumber(phone) || sanitizeUserContent(phone, { maxLength: 20 }) || null : null) : undefined
    const cleanAddress = typeof address !== 'undefined' ? (typeof address === 'string' ? sanitizeUserContent(address, { maxLength: 500 }) || null : null) : undefined
    const cleanAvatar = typeof avatar !== 'undefined' ? (typeof avatar === 'string' ? sanitizeUserContent(avatar, { maxLength: 500 }) || null : null) : undefined
    const cleanLanguage = typeof language !== 'undefined' ? (typeof language === 'string' ? sanitizeUserContent(language, { maxLength: 10 }) || null : null) : undefined
    const cleanCurrency = typeof currency !== 'undefined' ? (typeof currency === 'string' ? sanitizeUserContent(currency, { maxLength: 5 }) || null : null) : undefined
    const cleanTimezone = typeof timezone !== 'undefined' ? (typeof timezone === 'string' ? sanitizeUserContent(timezone, { maxLength: 50 }) || null : null) : undefined
    const cleanDarkMode = typeof darkMode !== 'undefined' ? (typeof darkMode === 'boolean' ? darkMode : null) : undefined
    const cleanEmailNotifications = typeof emailNotifications !== 'undefined' ? (typeof emailNotifications === 'boolean' ? emailNotifications : null) : undefined
    const cleanOrderNotifications = typeof orderNotifications !== 'undefined' ? (typeof orderNotifications === 'boolean' ? orderNotifications : null) : undefined
    const cleanPromotionalNotifications = typeof promotionalNotifications !== 'undefined' ? (typeof promotionalNotifications === 'boolean' ? promotionalNotifications : null) : undefined
    const cleanSystemNotifications = typeof systemNotifications !== 'undefined' ? (typeof systemNotifications === 'boolean' ? systemNotifications : null) : undefined

    const currentProfile = await getPrisma().profile.findUnique({
      where: { userId: payload.userId },
    })

    const profile = await getPrisma().profile.upsert({
      where: { userId: payload.userId },
      update: {
        ...(cleanFirstName !== undefined ? { firstName: cleanFirstName || null } : {}),
        ...(cleanLastName !== undefined ? { lastName: cleanLastName || null } : {}),
        ...(cleanPhone !== undefined ? { phone: cleanPhone || null } : {}),
        ...(cleanAddress !== undefined ? { address: cleanAddress } : {}),
        ...(cleanAvatar !== undefined ? { avatar: cleanAvatar || null } : {}),
        ...(cleanDarkMode !== undefined ? { darkMode: cleanDarkMode } : {}),
        ...(cleanLanguage !== undefined ? { language: cleanLanguage || null } : {}),
        ...(cleanCurrency !== undefined ? { currency: cleanCurrency || null } : {}),
        ...(cleanTimezone !== undefined ? { timezone: cleanTimezone || null } : {}),
        ...(cleanEmailNotifications !== undefined ? { emailNotifications: cleanEmailNotifications } : {}),
        ...(cleanOrderNotifications !== undefined ? { orderNotifications: cleanOrderNotifications } : {}),
        ...(cleanPromotionalNotifications !== undefined ? { promotionalNotifications: cleanPromotionalNotifications } : {}),
        ...(cleanSystemNotifications !== undefined ? { systemNotifications: cleanSystemNotifications } : {}),
      } as any,
      create: {
        userId: payload.userId,
        firstName: cleanFirstName || null,
        lastName: cleanLastName || null,
        phone: cleanPhone || null,
        address: cleanAddress || null,
        avatar: cleanAvatar || null,
        darkMode: cleanDarkMode ?? false,
        language: cleanLanguage ?? 'en',
        currency: cleanCurrency ?? 'GHS',
        timezone: cleanTimezone ?? 'Africa/Accra',
        emailNotifications: cleanEmailNotifications ?? true,
        orderNotifications: cleanOrderNotifications ?? true,
        promotionalNotifications: cleanPromotionalNotifications ?? false,
        systemNotifications: cleanSystemNotifications ?? true,
      } as any,
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