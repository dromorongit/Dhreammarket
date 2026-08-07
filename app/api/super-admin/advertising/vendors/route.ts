import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { logInfo, logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    const prisma = getPrisma()

    const vendors = await prisma.user.findMany({
      where: { role: 'VENDOR', status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        store: {
          select: {
            name: true,
          },
        },
      },
    })

    logInfo('Super admin advertising vendors fetched', { count: vendors.length })
    return NextResponse.json({ vendors })
  } catch (error) {
    logError('Error fetching advertising vendors', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
