import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateToken, generateOTP, hashOTP } from '@/lib/auth'
import { isVendorOnboarded } from '@/lib/onboarding'
import { sendEmailVerificationEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('email-verification')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const pendingReg = await getPrisma().pendingRegistration.findUnique({
      where: { email: normalizedEmail },
    })

    if (!pendingReg) {
      return NextResponse.json({ 
        message: 'If an account exists with this email, a verification code will be sent.' 
      }, { status: 200 })
    }

    const otp = generateOTP()
    const hashedOTP = hashOTP(otp)
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await getPrisma().pendingRegistration.update({
      where: { id: pendingReg.id },
      data: {
        hashedOTP,
        otpExpiresAt,
      },
    })

    try {
      await sendEmailVerificationEmail(
        pendingReg.email, 
        pendingReg.name || 'User', 
        otp, 
        otpExpiresAt
      )
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
    }

    return NextResponse.json({ 
      message: 'If an account exists with this email, a verification code will be sent.' 
    }, { status: 200 })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}