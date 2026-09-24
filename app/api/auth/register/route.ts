import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { hashPassword, generateOTP, hashOTP, generateToken } from '@/lib/auth'
import { normalizeGhanaPhoneNumber } from '@/lib/phone'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmailVerificationEmail } from '@/lib/email'
import { isEmailServiceEnabled } from '@/lib/feature-flags'
import { isVendorOnboarded } from '@/lib/onboarding'
import { ensureFreeSubscription } from '@/lib/subscription/subscription-service'
import { randomBytes } from 'crypto'
import { completeReferral } from '@/lib/loyalty/referral-engine'
import { processReferralSignup } from '@/lib/loyalty/process-referral-signup'

export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('register')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const { email, password, role, mobileNumber, name, ageConsent, referralCode, marketingCode, influencerCode } = await request.json()

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Email, password, and role are required' }, { status: 400 })
    }

    if (ageConsent !== true) {
      return NextResponse.json({ error: 'You must be 18 years of age or older to register' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
    }

    if (!['CUSTOMER', 'VENDOR'].includes(role)) {
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

    await getPrisma().pendingRegistration.deleteMany({
      where: {
        email: normalizedEmail,
        otpExpiresAt: { lt: new Date() }
      }
    })

    const existingUser = await getPrisma().user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      if (existingUser.isEmailVerified) {
        return NextResponse.json({ error: 'User already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'An account with this email already exists but is not verified. Please check your email or request a new verification code.' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(password)
    const emailServiceEnabled = isEmailServiceEnabled()
    const registrationIpAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null

    if (emailServiceEnabled) {
      const otp = generateOTP()
      const hashedOTP = hashOTP(otp)
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)

      await getPrisma().pendingRegistration.upsert({
        where: { email: normalizedEmail },
        update: {
          hashedOTP,
          otpExpiresAt,
          phone: normalizedPhone,
          role,
          name: role === 'CUSTOMER' ? name?.trim() : null,
          hashedPassword,
          referralCode: typeof referralCode === 'string' ? referralCode.trim() : null,
          marketingCode: typeof marketingCode === 'string' ? marketingCode.trim() : null,
          influencerCode: typeof influencerCode === 'string' ? influencerCode.trim() : null,
          registrationIpAddress,
        },
        create: {
          email: normalizedEmail,
          hashedOTP,
          otpExpiresAt,
          phone: normalizedPhone,
          role,
          name: role === 'CUSTOMER' ? name?.trim() : null,
          hashedPassword,
          referralCode: typeof referralCode === 'string' ? referralCode.trim() : null,
          marketingCode: typeof marketingCode === 'string' ? marketingCode.trim() : null,
          influencerCode: typeof influencerCode === 'string' ? influencerCode.trim() : null,
          registrationIpAddress,
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
    }

    try {
      const user = await getPrisma().$transaction(async (tx) => {
        const generatedReferralCode = role === 'CUSTOMER'
          ? `REF-${randomBytes(4).toString('hex').toUpperCase()}`
          : null

        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: hashedPassword,
            role,
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
            referralCode: generatedReferralCode,
            registrationIpAddress: registrationIpAddress,
          },
          select: {
            id: true,
            email: true,
            role: true,
          },
        })

        await tx.profile.create({
          data: {
            userId: createdUser.id,
            phone: normalizedPhone,
            firstName: role === 'CUSTOMER' ? name?.trim() : null,
          },
        })

        if (typeof marketingCode === 'string' && marketingCode.trim()) {
          const officer = await tx.marketingOfficer.findUnique({
            where: { referralCode: marketingCode.trim() },
          })
          if (!officer || !officer.active) {
            throw new Error('INVALID_MARKETING_REFERRAL_CODE')
          }
          await tx.vendorReferral.create({
            data: {
              vendorUserId: createdUser.id,
              marketingOfficerId: officer.id,
              codeUsed: marketingCode.trim(),
              amountOwed: 25.00,
            },
          })
        }

        if (typeof influencerCode === 'string' && influencerCode.trim()) {
          const influencer = await tx.influencer.findUnique({
            where: { referralCode: influencerCode.trim() },
          })
          if (influencer?.active && registrationIpAddress) {
            const existingInfluencerReferral = await tx.influencerReferral.findFirst({
              where: {
                influencerId: influencer.id,
                registrationIpAddress,
                refereeRole: role,
              },
            })
            if (!existingInfluencerReferral) {
              await tx.influencerReferral.create({
                data: {
                  influencerId: influencer.id,
                  refereeId: createdUser.id,
                  refereeRole: role,
                  codeUsed: influencerCode.trim(),
                  registrationIpAddress,
                },
              })
            }
          }
        }

        if (role === 'VENDOR') {
          try {
            await ensureFreeSubscription(createdUser.id, tx)
          } catch (subscriptionErr) {
            console.error('Failed to create free subscription for new vendor:', subscriptionErr)
          }
        }

        return {
          id: createdUser.id,
          email: createdUser.email,
          role: createdUser.role,
        }
      })

      try {
        await processReferralSignup({
          referralCode,
          userId: user.id,
          registrationIpAddress,
          role,
        })
      } catch (referralErr) {
        console.error('Referral processing failed:', {
          error: referralErr,
          referrerCode: referralCode,
          newUserId: user.id,
          timestamp: new Date().toISOString(),
        })
      }

      const sessionId = randomBytes(32).toString('hex')

      await getPrisma().session.create({
        data: {
          sessionId,
          userId: user.id,
          isExpired: false,
        },
      })

      const token = generateToken({ userId: user.id, role: user.role, sessionId })

      let isOnboarded: boolean | undefined = undefined
      if (user.role === 'VENDOR') {
        isOnboarded = await isVendorOnboarded(user.id)
      }

      const response = NextResponse.json({
        message: 'Registration successful',
        isEmailVerified: true,
        user: { id: user.id, email: user.email, role: user.role },
        isOnboarded
      }, { status: 201 })

      response.cookies.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })

      return response
    } catch (error: any) {
      if (error.message === 'INVALID_MARKETING_REFERRAL_CODE') {
        return NextResponse.json({ error: 'Invalid marketing referral code' }, { status: 400 })
      }
      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('email')) {
          return NextResponse.json({ error: 'User already exists' }, { status: 409 })
        }
        if (error.meta?.target?.includes('slug')) {
          return NextResponse.json({ error: 'Store slug conflict. Please try again.' }, { status: 409 })
        }
        if (error.meta?.target?.includes('referralCode')) {
          return NextResponse.json({ error: 'Referral code generation conflict. Please try again.' }, { status: 409 })
        }
      }
      console.error('Registration error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
