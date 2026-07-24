import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateToken } from '@/lib/auth'
import { generateSlug } from '@/lib/slug'
import { isVendorOnboarded } from '@/lib/onboarding'
import { rateLimit } from '@/lib/rate-limit'
import { isEmailServiceEnabled } from '@/lib/feature-flags'
import { isNewVendorApprovalRequired, isAutoApproveVendors } from '@/lib/platform-preferences'
import { randomBytes } from 'crypto'

export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('email-verification')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  const emailServiceEnabled = isEmailServiceEnabled()

  if (!emailServiceEnabled) {
    return NextResponse.json({ 
      message: 'Email verification is temporarily unavailable during maintenance. The verification code will remain valid for future use.'
    }, { status: 200 })
  }

  try {
    const { email, otp } = await request.json()

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: 'Invalid OTP format. Must be 6 digits.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const pendingReg = await getPrisma().pendingRegistration.findUnique({
      where: { email: normalizedEmail },
    })

    if (!pendingReg) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 })
    }

    if (pendingReg.otpExpiresAt < new Date()) {
      await getPrisma().pendingRegistration.delete({
        where: { id: pendingReg.id },
      })
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 })
    }

    const isValidOTP = bcrypt.compareSync(otp, pendingReg.hashedOTP)
    if (!isValidOTP) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 })
    }

    const existingUser = await getPrisma().user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      await getPrisma().pendingRegistration.delete({
        where: { id: pendingReg.id },
      })
      return NextResponse.json({ error: 'Email already verified. Please login.' }, { status: 200 })
    }

    try {
    const newVendorApproval = await isNewVendorApprovalRequired()
    const autoApproveVendors = await isAutoApproveVendors()
    const user = await getPrisma().$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: pendingReg.email,
            password: pendingReg.hashedPassword,
            role: pendingReg.role,
            position: pendingReg.role === 'ADMIN' ? pendingReg.position : null,
            status: pendingReg.role === 'VENDOR' && newVendorApproval && !autoApproveVendors ? 'SUSPENDED' : 'ACTIVE',
            isEmailVerified: true,
            emailVerifiedAt: new Date(),
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
            phone: pendingReg.phone,
            firstName: pendingReg.name,
          },
        })

        let storeData: { id: string; slug: string } | undefined
        if (pendingReg.role === 'VENDOR') {
          storeData = await tx.store.create({
            data: {
              userId: createdUser.id,
              name: pendingReg.name || 'My Store',
              slug: await generateSlug({
                baseText: pendingReg.name || 'My Store',
                target: 'Store',
                prismaClient: tx,
              }),
              isVerified: false,
            },
            select: { id: true, slug: true },
          })
        }

        return {
          id: createdUser.id,
          email: createdUser.email,
          role: createdUser.role,
          store: storeData,
        }
      })

      await getPrisma().pendingRegistration.delete({
        where: { id: pendingReg.id },
      })

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
        message: 'Email verified successfully',
        email: user.email,
        isEmailVerified: true,
        user: { id: user.id, email: user.email, role: user.role },
        isOnboarded
      }, { status: 200 })

      response.cookies.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })

      return response
    } catch (error: any) {
      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('email')) {
          await getPrisma().pendingRegistration.delete({
            where: { id: pendingReg.id },
          })
          return NextResponse.json({ error: 'Email already verified. Please login.' }, { status: 200 })
        }
        if (error.meta?.target?.includes('slug')) {
          return NextResponse.json({ error: 'Store slug conflict. Please contact support.' }, { status: 500 })
        }
      }
      console.error('Email verification error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
