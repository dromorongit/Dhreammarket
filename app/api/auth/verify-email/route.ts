import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { rateLimit } from '@/lib/rate-limit'
import { generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('email-verification')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
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

    const user = await getPrisma().user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 })
    }

    // Find valid auth token for email verification
    const authToken = await getPrisma().authToken.findFirst({
      where: {
        userId: user.id,
        tokenType: 'EMAIL_VERIFICATION',
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!authToken) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 })
    }

    // Verify OTP against stored hash
    const isValidOTP = bcrypt.compareSync(otp, authToken.tokenHash)
    if (!isValidOTP) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 })
    }

    // Mark email as verified
    await getPrisma().user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })

    // Mark token as used
    await getPrisma().authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() },
    })

    // Invalidate any other pending verification tokens for this user
    await getPrisma().authToken.updateMany({
      where: {
        userId: user.id,
        tokenType: 'EMAIL_VERIFICATION',
        usedAt: null,
        id: { not: authToken.id },
      },
      data: { usedAt: new Date() },
    })

    // Non-blocking audit log
    try {
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                        request.headers.get('x-real-ip') || 'unknown'
      const userAgent = request.headers.get('user-agent') || undefined
      
      await getPrisma().auditLog.create({
        data: {
          userId: user.id,
          userRole: user.role,
          action: 'EMAIL_VERIFIED',
          entityType: 'User',
          entityId: user.id,
          ipAddress,
          userAgent,
        },
      })
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError)
    }

    // Auto-login after verification - generate token and set cookie
    const token = generateToken({ userId: user.id, role: user.role })
    
    const response = NextResponse.json({ 
      message: 'Email verified successfully',
      email: user.email,
      isEmailVerified: true,
      user: { id: user.id, email: user.email, role: user.role }
    }, { status: 200 })
    
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    
    return response
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}