import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const paymentMethods = await getPrisma().paymentMethod.findMany({
      where: { userId: payload.userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ paymentMethods })
  } catch (error) {
    console.error('Error fetching payment methods:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, details, isDefault } = body

    const prisma = getPrisma()

    const typeUpper = (type || 'MOBILE_MONEY').toUpperCase()
    const normalizedType = ['MOBILE_MONEY', 'VISA_MASTERCARD'].includes(typeUpper)
      ? typeUpper
      : 'MOBILE_MONEY'

    if (isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { userId: payload.userId },
        data: { isDefault: false },
      })
    }

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        userId: payload.userId,
        type: normalizedType,
        details: details || {},
        isDefault: isDefault ?? false,
      },
    })

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'PROFILE_UPDATED',
      entityType: 'USER',
      entityId: payload.userId,
      afterData: { paymentMethodId: paymentMethod.id, action: 'created' },
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ paymentMethod }, { status: 201 })
  } catch (error) {
    console.error('Error creating payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
