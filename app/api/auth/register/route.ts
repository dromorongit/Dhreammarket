import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { hashPassword, generateOTP, hashOTP } from '@/lib/auth'
import { normalizeGhanaPhoneNumber } from '@/lib/phone'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmailVerificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
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

    if (role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'SUPER_ADMIN accounts cannot be created via public registration' }, { status: 403 })
    }

    let normalizedPhone: string | null = null
    if (mobileNumber) {
      normalizedPhone = normalizeGhanaPhoneNumber(mobileNumber)
      if (!normalizedPhone) {
        return NextResponse.json({ error: 'Invalid Ghana mobile number format' }, { status: 400 })
      }
    }

    if (role === 'CUSTOMER' && !name) {
      return NextResponse.json({ error: 'Name is required for customer registration' }, { status: 400 })
    }

    if (role === 'ADMIN' && (!position || !position.trim())) {
      return NextResponse.json({ error: 'Position is required for ADMIN accounts' }, { status: 400 })
    }

    // Clean up any expired pending registrations for this email
    await getPrisma().pendingRegistration.deleteMany({
      where: {
        email: normalizedEmail,
        otpExpiresAt: { lt: new Date() }
      }
    })

    const existingUser = await getPrisma().user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser && existingUser.isEmailVerified) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }

    const existingPending = await getPrisma().pendingRegistration.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingPending) {
      return NextResponse.json({ error: 'Registration already pending. Please check your email for the verification code.' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(password)

    const otp = generateOTP()
    const hashedOTP = hashOTP(otp)
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await getPrisma().pendingRegistration.create({
      data: {
        email: normalizedEmail,
        hashedOTP,
        otpExpiresAt,
        phone: normalizedPhone,
        role,
        position: role === 'ADMIN' ? position?.trim() : null,
        name: role === 'CUSTOMER' ? name?.trim() : null,
        hashedPassword,
      },
    })

    try {
      await sendEmailVerificationEmail(normalizedEmail, name || 'User', otp, otpExpiresAt)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
    }

    return NextResponse.json({ 
      message: 'Registration successful. Please verify your email.', 
      needsVerification: true,
      email: normalizedEmail
    }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}