import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// GET all users with pagination
export async function GET(request: NextRequest) {
  console.log('[ADMIN USERS] GET request started')
  try {
    const prisma = getPrisma()
    console.log('[ADMIN USERS] Prisma client obtained')
    const authCheck = requireAdmin()
    console.log('[ADMIN USERS] Auth check result:', authCheck instanceof NextResponse ? `response ${authCheck.status}` : 'authorized')
    if (authCheck instanceof NextResponse) {
      console.log('[ADMIN USERS] Auth check returned error response:', authCheck.status)
      return authCheck
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const role = searchParams.get('role')
    const search = searchParams.get('search')
    console.log('[ADMIN USERS] Query params:', { page, limit, role, search })

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
     
    if (role && ['SUPER_ADMIN', 'ADMIN', 'VENDOR', 'CUSTOMER'].includes(role)) {
      where.role = role
    }
     
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    console.log('[ADMIN USERS] Querying users with where:', JSON.stringify(where))
    const [users, total] = await Promise.all([
      console.log('[ADMIN USERS] Query: prisma.user.findMany'), prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
        },
      }),
      console.log('[ADMIN USERS] Query: prisma.user.count'), prisma.user.count({ where }),
    ])
    console.log('[ADMIN USERS] Query results:', { usersCount: users.length, total })

    const totalPages = Math.ceil(total / limit)

    const transformedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      mobileNumber: user.profile?.phone || null,
      profile: {
        firstName: user.profile?.firstName,
        lastName: user.profile?.lastName,
        phone: user.profile?.phone,
      },
      store: user.store,
    }))

    const responseData = {
      users: transformedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }
    console.log('[ADMIN USERS] Returning response:', JSON.stringify(responseData).substring(0, 1000))

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('[ADMIN USERS] Error:', error)
    console.error('[ADMIN USERS] Error stack:', error?.stack)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}