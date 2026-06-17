import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { generateResetToken, hashResetToken } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limiting - security hardening
  const rateLimitCheck = rateLimit('password-reset-new')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Find user by email (do not reveal if email exists or not)
    const user = await getPrisma().user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    })

    if (user) {
      // Invalidate existing password reset tokens
      await getPrisma().authToken.updateMany({
        where: {
          userId: user.id,
          tokenType: 'PASSWORD_RESET',
          usedAt: null,
        },
        data: { usedAt: new Date() },
      })

      // Generate secure reset token
      const resetToken = generateResetToken()
      const hashedToken = hashResetToken(resetToken)

      // Set expiration (1 hour from now)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

      // Create AuthToken entry
      await getPrisma().authToken.create({
        data: {
          userId: user.id,
          tokenType: 'PASSWORD_RESET',
          tokenHash: hashedToken,
          expiresAt,
        },
      })

      // Get customer name for email personalization
      const customerName = user.profile?.firstName && user.profile?.lastName
        ? `${user.profile.firstName} ${user.profile.lastName}`
        : user.profile?.firstName
        ? user.profile.firstName
        : 'Valued Customer'

      // Non-blocking audit log
      try {
        const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                          request.headers.get('x-real-ip') || 'unknown'
        
        await getPrisma().auditLog.create({
          data: {
            userId: user.id,
            userRole: user.role,
            action: 'PASSWORD_RESET_REQUESTED',
            entityType: 'User',
            entityId: user.id,
            ipAddress,
          },
        })
      } catch (auditError) {
        console.error('Failed to create audit log:', auditError)
      }

      // Send email (non-blocking)
      try {
        await sendPasswordResetEmail(user.email, customerName, resetToken, expiresAt)
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError)
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json(
      { message: 'If an account exists with this email, you will receive a password reset link shortly.' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
