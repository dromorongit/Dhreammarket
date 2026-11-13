import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { ensurePayLinkForOrder } from '@/lib/manual-order-paylink'

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

    const result = await ensurePayLinkForOrder({
      ...existingOrder,
      storeId: store.id,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    if (result.paymentStatus === 'PAID') {
      return NextResponse.json({ receiptUrl: result.receiptUrl })
    }

    return NextResponse.json({
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
      receiptUrl: result.receiptUrl,
    })
  } catch (error) {
    console.error('Error creating manual order pay link:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
}

