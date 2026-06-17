import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { hashPassword, generateOTP, hashOTP } from '@/lib/auth'
import { normalizeGhanaPhoneNumber } from '@/lib/phone'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmailVerificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  // Rate limiting - security hardening
  const rateLimitCheck = rateLimit('register')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const { email, password, role, position, mobileNumber, name } = await request.json()

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Email, password, and role are required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
    }

    if (!['CUSTOMER', 'VENDOR', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Prevent SUPER_ADMIN creation via public registration endpoint
    if (role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'SUPER_ADMIN accounts cannot be created via public registration' }, { status: 403 })
    }

    // Validate mobile number for CUSTOMER and VENDOR roles
    let normalizedPhone: string | null = null
    if (mobileNumber) {
      normalizedPhone = normalizeGhanaPhoneNumber(mobileNumber)
      if (!normalizedPhone) {
        return NextResponse.json({ error: 'Invalid Ghana mobile number format' }, { status: 400 })
      }
    }

    // Validate name for CUSTOMER role
    if (role === 'CUSTOMER' && !name) {
      return NextResponse.json({ error: 'Name is required for customer registration' }, { status: 400 })
    }

    // Validate position for ADMIN role
    if (role === 'ADMIN' && (!position || !position.trim())) {
      return NextResponse.json({ error: 'Position is required for ADMIN accounts' }, { status: 400 })
    }

    const existingUser = await getPrisma().user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(password)

    // Generate and hash OTP for email verification
    const otp = generateOTP()
    const hashedOTP = hashOTP(otp)
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    const user = await getPrisma().user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role,
        position: role === 'ADMIN' ? position.trim() : null,
        profile: {
          create: {
            phone: normalizedPhone,
            firstName: role === 'CUSTOMER' ? name?.trim() : undefined,
          },
        },
        authTokens: {
          create: {
            tokenType: 'EMAIL_VERIFICATION',
            tokenHash: hashedOTP,
            expiresAt: otpExpiresAt,
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        position: true,
        profile: {
          select: {
            phone: true,
            firstName: true,
          },
        },
      },
    })

    // Send OTP email (non-blocking)
    try {
      await sendEmailVerificationEmail(user.email, user.profile?.firstName || 'User', otp, otpExpiresAt)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // Continue - don't block registration on email failure
    }

    // Non-blocking audit log
    try {
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                        request.headers.get('x-real-ip') || 'unknown'
      
      await getPrisma().auditLog.create({
        data: {
          userId: user.id,
          userRole: user.role,
          action: 'OTP_SENT',
          entityType: 'User',
          entityId: user.id,
          ipAddress,
        },
      })
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError)
    }

    return NextResponse.json({ 
      message: 'Registration successful. Please verify your email.', 
      needsVerification: true,
      user: { id: user.id, email: user.email, role: user.role }
    }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}