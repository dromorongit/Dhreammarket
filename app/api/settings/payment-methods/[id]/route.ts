import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
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
    const { id, type, details, isDefault } = body

    if (!id) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 })
    }

    const prisma = getPrisma()
    const existing = await prisma.paymentMethod.findFirst({
      where: { id, userId: payload.userId, isActive: true },
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
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ paymentMethod })
  } catch (error) {
    console.error('Error updating payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 })
    }

    const prisma = getPrisma()
    const existing = await prisma.paymentMethod.findFirst({
      where: { id, userId: payload.userId, isActive: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    await prisma.paymentMethod.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
