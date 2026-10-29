import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { generateSelector, generateResetSecret, hashResetToken, hashPassword } from '@/lib/auth'
import { sendAdminInitiatedPasswordResetEmail, sendPasswordChangedEmail } from '@/lib/email'
import { rateLimitByKey, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit-log'
import { validatePassword } from '@/lib/password-validation'

interface RouteParams {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authCheck = await requireSuperAdmin()
  if (authCheck instanceof NextResponse) {
    return authCheck
  }
  const admin = authCheck

  const rateLimitCheck = rateLimitByKey(`admin-reset-password:${admin.userId}`, RATE_LIMIT_CONFIGS['admin-reset-password'])
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  const { id: targetId } = await params

  let body: { mode?: string; newPassword?: string; expireSessions?: boolean }
  try {
    body = (await request.json()) as { mode?: string; newPassword?: string; expireSessions?: boolean }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const mode = body.mode ?? 'link'
  if (mode !== 'link' && mode !== 'manual') {
    return NextResponse.json({ error: 'Invalid mode. Use "link" or "manual".' }, { status: 400 })
  }

  const prisma = getPrisma()

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    include: { profile: true },
  })

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (target.id === admin.userId) {
    return NextResponse.json({ error: 'Use the change-password endpoint for your own account.' }, { status: 400 })
  }

  if (target.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Cannot reset the password of another SUPER_ADMIN.' }, { status: 403 })
  }

  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const expireSessions = body.expireSessions !== false

  const customerName = [target.profile?.firstName, target.profile?.lastName].filter(Boolean).join(' ') || target.email

  if (mode === 'link') {
    // Invalidate any existing unused password reset tokens for the target.
    await prisma.authToken.updateMany({
      where: {
        userId: targetId,
        tokenType: 'PASSWORD_RESET',
        usedAt: null,
      },
      data: { usedAt: new Date() },
    })

    // Create a new single-use reset token, same helpers as the forgot-password flow.
    const selector = generateSelector()
    const secretToken = generateResetSecret()
    const tokenHash = hashResetToken(secretToken)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.authToken.create({
      data: {
        userId: targetId,
        tokenType: 'PASSWORD_RESET',
        selector,
        tokenHash,
        expiresAt,
        ipAddress: clientIP,
        userAgent,
      },
    })

    if (expireSessions) {
      await prisma.session.updateMany({
        where: { userId: targetId, isExpired: false },
        data: { isExpired: true, expiredAt: new Date() },
      })
    }

    // Send the admin-initiated reset email. A failure is reported, never masked as success.
    const emailResult = await sendAdminInitiatedPasswordResetEmail(target.email, customerName, selector, secretToken, expiresAt)
    const emailSent = emailResult.success === true

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Password reset email could not be sent. Please try again later.' },
        { status: 502 }
      )
    }

    await createAuditLog({
      userId: admin.userId,
      userRole: 'SUPER_ADMIN',
      action: 'ADMIN_PASSWORD_RESET',
      entityType: 'USER',
      entityId: targetId,
      afterData: { mode, sessionsExpired: expireSessions, emailSent: true },
      ipAddress: clientIP,
      userAgent,
    })

    return NextResponse.json({ success: true, mode: 'link', emailSent: true })
  }

  // mode === 'manual'
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
  const passwordValidationError = validatePassword(newPassword)
  if (passwordValidationError) {
    return NextResponse.json({ error: passwordValidationError }, { status: 400 })
  }

  const hashedPassword = await hashPassword(newPassword)
  const now = new Date()

  // Password update, token invalidation, and session expiry in one transaction.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetId },
      data: { password: hashedPassword },
    })

    await tx.authToken.updateMany({
      where: {
        userId: targetId,
        tokenType: 'PASSWORD_RESET',
        usedAt: null,
      },
      data: { usedAt: now },
    })

    if (expireSessions) {
      await tx.session.updateMany({
        where: { userId: targetId, isExpired: false },
        data: { isExpired: true, expiredAt: now },
      })
    }
  })

  // Password changed notification. A failure does not roll back the reset.
  let emailSent = false
  try {
    const emailResult = await sendPasswordChangedEmail(target.email, customerName)
    emailSent = emailResult.success === true
  } catch {
    emailSent = false
  }

  await createAuditLog({
    userId: admin.userId,
    userRole: 'SUPER_ADMIN',
    action: 'ADMIN_PASSWORD_RESET',
    entityType: 'USER',
    entityId: targetId,
    afterData: { mode, sessionsExpired: expireSessions, emailSent },
    ipAddress: clientIP,
    userAgent,
  })

  return NextResponse.json({ success: true, mode: 'manual', emailSent })
}
