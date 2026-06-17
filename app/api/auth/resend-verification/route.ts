import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { generateOTP, hashOTP } from '@/lib/auth'
import { sendEmailVerificationEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('otp-resend')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const user = await getPrisma().user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: { select: { firstName: true } } },
    })

    if (!user) {
      // Return success to prevent email enumeration
      return NextResponse.json({ 
        message: 'If an account exists with this email, a verification code will be sent.' 
      }, { status: 200 })
    }

    // Skip if email already verified
    if (user.isEmailVerified) {
      return NextResponse.json({ 
        message: 'Email is already verified. You can login now.' 
      }, { status: 200 })
    }

    // Invalidate existing verification tokens
    await getPrisma().authToken.updateMany({
      where: {
        userId: user.id,
        tokenType: 'EMAIL_VERIFICATION',
        usedAt: null,
      },
      data: { usedAt: new Date() },
    })

    // Generate new OTP
    const otp = generateOTP()
    const hashedOTP = hashOTP(otp)
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store new token
    await getPrisma().authToken.create({
      data: {
        userId: user.id,
        tokenType: 'EMAIL_VERIFICATION',
        tokenHash: hashedOTP,
        expiresAt: otpExpiresAt,
      },
    })

    // Send OTP email (non-blocking)
    try {
      await sendEmailVerificationEmail(user.email, user.profile?.firstName || 'User', otp, otpExpiresAt)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
    }

    // Non-blocking audit log
    try {
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                        request.headers.get('x-real-ip') || 'unknown'
      const userAgent = request.headers.get('user-agent') || undefined
      
      await getPrisma().auditLog.create({
        data: {
          userId: user.id,
          userRole: user.role,
          action: 'OTP_RESENT',
          entityType: 'User',
          entityId: user.id,
          ipAddress,
          userAgent,
        },
      })
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError)
    }

    return NextResponse.json({ 
      message: 'If an account exists with this email, a verification code will be sent.' 
    }, { status: 200 })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}