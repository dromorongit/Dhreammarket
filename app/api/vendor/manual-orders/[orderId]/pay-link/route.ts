import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { initializePaystackPayment } from '@/lib/paystack'
import { SITE_URL } from '@/lib/site-config'
import { buildReceiptUrl, orderDisplayNumber } from '@/lib/manual-orders'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    if (process.env.PAYLINK_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Pay links are disabled' }, { status: 503 })
    }

    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup to create a pay link' },
        { status: 403 }
      )
    }

    const orderId = params.orderId

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const existingOrder = await getPrisma().order.findFirst({
      where: {
        id: orderId,
        items: {
          some: {
            product: {
              storeId: store.id,
            },
          },
        },
      },
      select: {
        id: true,
        source: true,
        status: true,
        paymentStatus: true,
        total: true,
        receiptToken: true,
        customerEmail: true,
      },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Manual order not found or access denied' },
        { status: 404 }
      )
    }

    if (existingOrder.source !== 'MANUAL') {
      return NextResponse.json(
        { error: 'Only manual orders can receive a pay link' },
        { status: 409 }
      )
    }

    if (existingOrder.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot create a pay link for a cancelled order' },
        { status: 409 }
      )
    }

    if (!(existingOrder.total > 0)) {
      return NextResponse.json(
        { error: 'Order total must be greater than 0' },
        { status: 400 }
      )
    }

    const receiptUrl = buildReceiptUrl(existingOrder.receiptToken!)

    if (existingOrder.paymentStatus === 'PAID') {
      return NextResponse.json({ receiptUrl })
    }

    const existingPayment = await getPrisma().payment.findUnique({
      where: { orderId },
      select: { id: true, reference: true, amount: true, status: true, authorizationUrl: true },
    })

    if (
      existingPayment &&
      (existingPayment.status as string) === 'PAID' &&
      (existingOrder.paymentStatus as string) !== 'PAID'
    ) {
      return NextResponse.json(
        { error: 'payment received, needs review' },
        { status: 409 }
      )
    }

    const amountMatches =
      !!existingPayment &&
      existingPayment.status === 'PENDING' &&
      !!existingPayment.authorizationUrl &&
      Math.abs(existingPayment.amount - existingOrder.total) <= 0.01

    if (amountMatches) {
      return NextResponse.json({
        authorizationUrl: existingPayment.authorizationUrl,
        reference: existingPayment.reference,
        receiptUrl,
      })
    }

    const email =
      existingOrder.customerEmail ||
      (process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN
        ? `pay+${orderDisplayNumber(existingOrder.id)}@${process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN}`
        : undefined)

    if (!email) {
      return NextResponse.json(
        {
          error:
            'Customer email is required and PAYLINK_FALLBACK_EMAIL_DOMAIN is not set',
        },
        { status: 400 }
      )
    }

    const reference = `MAN-${crypto.randomBytes(8).toString('hex').toUpperCase()}`

    const paystackResponse = await initializePaystackPayment(
      email,
      existingOrder.total,
      reference,
      `${SITE_URL}/receipt/${existingOrder.receiptToken}`,
      { orderId, source: 'MANUAL', storeId: store.id }
    )

    const authorizationUrl = paystackResponse.data.authorization_url
    const paystackRef = paystackResponse.data.reference

    const payment = await getPrisma().payment.upsert({
      where: { orderId },
      update: {
        reference,
        amount: existingOrder.total,
        currency: 'GHS',
        status: 'PENDING',
        userId: null,
        paystackRef,
        authorizationUrl,
      },
      create: {
        orderId,
        userId: null,
        amount: existingOrder.total,
        currency: 'GHS',
        status: 'PENDING',
        reference,
        paystackRef,
        authorizationUrl,
      },
    })

    return NextResponse.json({
      authorizationUrl: payment.authorizationUrl,
      reference: payment.reference,
      receiptUrl,
    })
  } catch (error) {
    console.error('Error creating manual order pay link:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    )
  }
}
