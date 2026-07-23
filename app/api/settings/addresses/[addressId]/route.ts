import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { addressId: string } }) {
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
    const { label, street, region, city, isDefault } = body

    const prisma = getPrisma()

    const existing = await prisma.address.findFirst({
      where: { id: params.addressId, userId: payload.userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: payload.userId },
        data: { isDefault: false },
      })
    }

    const updateData: any = {}
    if (label !== undefined) updateData.label = label?.trim() || null
    if (street !== undefined) updateData.street = street.trim()
    if (region !== undefined) updateData.region = region.trim()
    if (city !== undefined) updateData.city = city.trim()
    if (isDefault !== undefined) updateData.isDefault = isDefault

    const address = await prisma.address.update({
      where: { id: params.addressId },
      data: updateData,
    })

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'PROFILE_UPDATED',
      entityType: 'USER',
      entityId: payload.userId,
      afterData: { addressId: address.id, action: 'updated' },
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ address })
  } catch (error) {
    console.error('Error updating address:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { addressId: string } }) {
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

    const existing = await prisma.address.findFirst({
      where: { id: params.addressId, userId: payload.userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    const wasDefault = existing.isDefault

    await prisma.address.delete({
      where: { id: params.addressId },
    })

    if (wasDefault) {
      const remaining = await prisma.address.findMany({
        where: { userId: payload.userId },
        orderBy: { createdAt: 'asc' },
        take: 1,
      })
      if (remaining.length > 0) {
        await prisma.address.update({
          where: { id: remaining[0].id },
          data: { isDefault: true },
        })
      }
    }

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'PROFILE_UPDATED',
      entityType: 'USER',
      entityId: payload.userId,
      afterData: { addressId: params.addressId, action: 'deleted' },
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting address:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
