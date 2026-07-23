import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
    const existing = await prisma.paymentMethod.findFirst({
      where: { id: params.id, userId: payload.userId, isActive: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (type !== undefined) updateData.type = type.toUpperCase()
    if (details !== undefined) updateData.details = details
    if (isDefault !== undefined) {
      if (isDefault) {
        await prisma.paymentMethod.updateMany({
          where: { userId: payload.userId },
          data: { isDefault: false },
        })
      }
      updateData.isDefault = isDefault
    }

    const paymentMethod = await prisma.paymentMethod.update({
      where: { id: params.id },
      data: updateData,
    })

    const action = isDefault ? 'PAYMENT_METHOD_SET_DEFAULT' : 'PAYMENT_METHOD_UPDATED'

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action,
      entityType: 'PAYMENT_METHOD',
      entityId: params.id,
      afterData: { paymentMethodId: params.id, action: isDefault ? 'set_default' : 'updated' },
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ paymentMethod })
  } catch (error) {
    console.error('Error updating payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prisma = getPrisma()
    const existing = await prisma.paymentMethod.findFirst({
      where: { id: params.id, userId: payload.userId, isActive: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    await prisma.paymentMethod.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'PAYMENT_METHOD_DELETED',
      entityType: 'PAYMENT_METHOD',
      entityId: params.id,
      afterData: { paymentMethodId: params.id, action: 'deleted' },
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
