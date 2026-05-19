import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, role, position } = await request.json()

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

    const user = await getPrisma().user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role,
        position: role === 'ADMIN' ? position.trim() : null,
        profile: {
          create: {},
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        position: true,
      },
    })

    return NextResponse.json({ message: 'Registration successful', user }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}