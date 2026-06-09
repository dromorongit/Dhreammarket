import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
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

    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = generateToken({ userId: user.id, role: user.role })

    // Set cookie duration based on rememberMe preference
    // If checked: 30 days, otherwise: 7 days (default session)
    const cookieMaxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7

    console.log('Setting token cookie')
    console.log('NODE_ENV:', process.env.NODE_ENV)
    console.log('Cookie secure flag:', process.env.NODE_ENV === 'production')
    
    const response = NextResponse.json({ message: 'Login successful', user: { id: user.id, email: user.email, role: user.role } })
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