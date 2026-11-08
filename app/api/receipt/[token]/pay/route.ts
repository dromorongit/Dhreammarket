import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { ensurePayLinkForOrder } from '@/lib/manual-order-paylink'
import { rateLimitByKey, RATE_LIMIT_CONFIGS, getClientIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const RECEIPT_TOKEN_REGEX = /^[0-9a-f]{32}$/
const GENERIC_ERROR = 'Unable to start payment right now. Please try again.'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    if (process.env.PAYLINK_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Pay links are not available yet' }, { status: 503 })
    }

    const token = params.token
    if (!RECEIPT_TOKEN_REGEX.test(token || '')) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    const ip = getClientIP(request)
    const ipLimit = rateLimitByKey(`receipt-pay:ip:${ip}`, RATE_LIMIT_CONFIGS['receipt-pay'])
    if (!ipLimit.success) return ipLimit.response
    const tokenLimit = rateLimitByKey(`receipt-pay:token:${token}`, RATE_LIMIT_CONFIGS['receipt-pay'])
    if (!tokenLimit.success) return tokenLimit.response

    const order = await getPrisma().order.findFirst({
      where: {
        receiptToken: token,
        source: 'MANUAL',
      },
      select: {
        id: true,
        source: true,
        status: true,
        paymentStatus: true,
        total: true,
        receiptToken: true,
        customerEmail: true,
        items: {
          take: 1,
          select: { product: { select: { storeId: true } } },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    const storeId = order.items[0]?.product?.storeId
    if (!storeId) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    const result = await ensurePayLinkForOrder({
      id: order.id,
      source: order.source,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      receiptToken: order.receiptToken,
      customerEmail: order.customerEmail,
      storeId,
    })

    if (!result.ok) {
      const message =
        result.status === 409
          ? result.error
          : result.status === 404
            ? 'Receipt not found'
            : GENERIC_ERROR
      return NextResponse.json({ error: message }, { status: result.status })
    }

    if (result.paymentStatus === 'PAID' || !result.authorizationUrl) {
      return NextResponse.json(
        { error: 'This order is already paid' },
        { status: 409 }
      )
    }

    return NextResponse.json({ authorizationUrl: result.authorizationUrl })
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }
}
