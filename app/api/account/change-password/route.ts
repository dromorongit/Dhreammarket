import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit-log'
import { sendPasswordChangedEmail } from '@/lib/email'
import { isEmailServiceEnabled } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter'
  }
  if (!/\d/.test(password)) {
    return 'Password must contain at least one number'
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character'
  }
  return null
}

export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('change-password')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { currentPassword, newPassword, confirmNewPassword } = await request.json()

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return NextResponse.json(
        { error: 'Current password, new password, and confirm new password are required' },
        { status: 400 }
      )
    }

    const user = await getPrisma().user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, password: true, profile: { select: { firstName: true, lastName: true } } },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    if (newPassword !== confirmNewPassword) {
      return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 })
    }

    const passwordValidationError = validatePassword(newPassword)
    if (passwordValidationError) {
      return NextResponse.json({ error: passwordValidationError }, { status: 400 })
    }

    const isSameAsCurrent = await verifyPassword(newPassword, user.password)
    if (isSameAsCurrent) {
      return NextResponse.json({ error: 'New password must be different from current password' }, { status: 400 })
    }

    const hashedNewPassword = await hashPassword(newPassword)

    await getPrisma().user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword },
    })

    const emailServiceEnabled = isEmailServiceEnabled()
    const userEmail = user.email || ''
    const displayName = [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ') || userEmail

    if (emailServiceEnabled && userEmail) {
      sendPasswordChangedEmail(userEmail, displayName).catch((err) =>
        console.error('Failed to send password changed email:', err)
      )
    }

    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.headers.get('host') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    createAuditLog({
      userId: user.id,
      userRole: payload.role || 'USER',
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: clientIP,
      userAgent: userAgent,
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
