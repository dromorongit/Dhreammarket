import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { getUserFromToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Verify SUPER_ADMIN authentication
    const user = getUserFromToken()
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 })
    }

    const { name, email, password, position } = await request.json()

    if (!email || !password || !position) {
      return NextResponse.json({ error: 'Email, password, and position are required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
    }

    if (!position.trim()) {
      return NextResponse.json({ error: 'Position is required' }, { status: 400 })
    }

    const existingUser = await getPrisma().user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(password)

    const adminUser = await getPrisma().user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: 'ADMIN',
        position: position.trim(),
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            firstName: name.trim().split(' ')[0],
            lastName: name.trim().split(' ').slice(1).join(' ') || null,
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
            firstName: true,
            lastName: true,
          }
        }
      },
    })

    return NextResponse.json({ 
      message: 'Admin employee created successfully', 
      user: adminUser 
    }, { status: 201 })
  } catch (error) {
    console.error('Create admin error:', error)
    return NextResponse.json({ error: 'Failed to create admin employee' }, { status: 500 })
  }
}
