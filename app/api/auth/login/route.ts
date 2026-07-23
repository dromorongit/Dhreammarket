import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'
import { randomBytes } from 'crypto'
import { rateLimit } from '@/lib/rate-limit'
import { isVendorOnboarded } from '@/lib/onboarding'
import { isEmailServiceEnabled } from '@/lib/feature-flags'
import { parseUserAgent } from '@/lib/device-detector'

export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('login')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    const { email, password, rememberMe = false } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await getPrisma().user.findUnique({
      where: { email },
      include: { profile: true, store: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Check account status
    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
    }

    const emailServiceEnabled = isEmailServiceEnabled()

    // Check email verification (skip for ADMIN and SUPER_ADMIN, and during maintenance)
    if (!emailServiceEnabled && !user.isEmailVerified && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      // Allow login during email service maintenance
    } else if (emailServiceEnabled && !user.isEmailVerified && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ 
        needsVerification: true,
        message: 'Please verify your email before logging in' 
      }, { status: 200 })
    }

    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const sessionId = randomBytes(32).toString('hex')
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || undefined
    const { device, browser, os } = parseUserAgent(userAgent)

    await getPrisma().session.create({
      data: {
        sessionId,
        userId: user.id,
        device,
        browser,
        os,
        ipAddress,
        userAgent,
        isExpired: false,
      },
    })

    const token = generateToken({ userId: user.id, role: user.role, sessionId })

    // Set cookie duration based on rememberMe preference
    // If checked: 30 days, otherwise: 7 days (default session)
    const cookieMaxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7

    console.log('Setting token cookie')
    console.log('NODE_ENV:', process.env.NODE_ENV)
    console.log('Cookie secure flag:', process.env.NODE_ENV === 'production')

    // Check vendor onboarding status
    let isOnboarded: boolean | undefined = undefined
    if (user.role === 'VENDOR') {
      isOnboarded = await isVendorOnboarded(user.id)
    }

    const response = NextResponse.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, role: user.role },
      isOnboarded
    })
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      path: '/',
    })

    console.log('Response Set-Cookie header:', response.headers.get('set-cookie'))

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}