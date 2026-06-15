import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { generateResetToken, hashResetToken } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limiting - security hardening
  const rateLimitCheck = rateLimit('forgot-password')(request)
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
      // Generate secure reset token
      const resetToken = generateResetToken()
      const hashedToken = hashResetToken(resetToken)

      // Set expiration (1 hour from now)
      const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000)

      // Save token and expiration to user record
      await getPrisma().user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: hashedToken,
          resetPasswordExpires,
        },
      })

      // Get customer name for email personalization
      const customerName = user.profile?.firstName && user.profile?.lastName
        ? `${user.profile.firstName} ${user.profile.lastName}`
        : user.profile?.firstName
        ? user.profile.firstName
        : 'Valued Customer'

      try {
        await sendPasswordResetEmail(user.email, customerName, resetToken, resetPasswordExpires)
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError)
        // Continue even if email fails - security best practice
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
