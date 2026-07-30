import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

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

    const { couponCode, orderId } = await request.json()

    if (!couponCode || !orderId) {
      return NextResponse.json({ error: 'Coupon code and order ID are required' }, { status: 400 })
    }

    const coupon = await getPrisma().coupon.findUnique({
      where: { code: couponCode.toUpperCase() },
    })

    if (!coupon || !coupon.isActive) {
      return NextResponse.json({ error: 'Invalid coupon' }, { status: 404 })
    }

    if (coupon.expiryDate < new Date()) {
      return NextResponse.json({ error: 'Coupon has expired' }, { status: 400 })
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({ error: 'Coupon usage limit reached' }, { status: 400 })
    }

    const existingUsage = await getPrisma().couponUsage.findFirst({
      where: { couponId: coupon.id, userId: payload.userId },
    })

    if (existingUsage) {
      return NextResponse.json({ error: 'You have already used this coupon' }, { status: 400 })
    }

    const order = await getPrisma().order.findUnique({
      where: { id: orderId },
      select: { total: true, userId: true },
    })

    if (!order || order.userId !== payload.userId) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (coupon.minSpend && order.total < coupon.minSpend) {
      return NextResponse.json({ error: `Minimum spend of ${coupon.minSpend} required` }, { status: 400 })
    }

    let discount = 0
    if (coupon.type === 'PERCENTAGE') {
      discount = order.total * (coupon.value / 100)
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount
      }
    } else if (coupon.type === 'FIXED_AMOUNT') {
      discount = coupon.value
    }

    await getPrisma().couponUsage.create({
      data: {
        couponId: coupon.id,
        userId: payload.userId,
        orderId,
        usedAt: new Date(),
      },
    })

    await getPrisma().coupon.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    })

    return NextResponse.json({
      success: true,
      discount: parseFloat(discount.toFixed(2)),
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      },
    })
  } catch (error) {
    console.error('Error applying coupon:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}