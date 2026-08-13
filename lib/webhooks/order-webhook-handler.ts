import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyPaystackPayment } from '@/lib/paystack'
import { calculateFinancialBreakdown, resolveProcessorFee } from '@/lib/revenue'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { reserveStock, releaseStock } from '@/lib/stock-reservation'
import { createAuditLog } from '@/lib/audit-log'
import crypto from 'crypto'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

function verifyPaystackSignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false
  if (!PAYSTACK_SECRET_KEY) return false

  const expectedSignature = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}

export async function handleOrderWebhook(body: string, signature: string | undefined): Promise<NextResponse> {
  try {
    if (!verifyPaystackSignature(body, signature ?? undefined)) {
      console.error('[Payment Webhook] Invalid signature - rejecting webhook')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const parsedBody = JSON.parse(body)
    const reference = parsedBody.data?.reference

    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }

    const payment = await getPrisma().payment.findUnique({
      where: { reference },
      include: {
        order: true,
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const paystackResponse = await verifyPaystackPayment(reference)
    const paymentStatus = paystackResponse.data.status

    if (payment.status === 'PAID' || payment.order?.status !== 'PENDING') {
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }

    if (paymentStatus !== 'success') {
      const isAbandoned = paymentStatus === 'abandoned'
      const isCancelled = paymentStatus === 'cancelled'
      const failedStatus = (isAbandoned || isCancelled) ? 'CANCELLED' : 'FAILED'

      await getPrisma().$transaction(async (prisma: any) => {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: failedStatus,
            message: isAbandoned ? 'Payment abandoned via webhook' : isCancelled ? 'Payment cancelled via webhook' : 'Payment failed via webhook',
          },
        })

        await prisma.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: failedStatus,
            status: 'CANCELLED',
          },
        })
      })

      await createAuditLog({
        userId: payment.userId,
        userRole: 'SYSTEM',
        action: 'PAYMENT_FAILED',
        entityType: 'ORDER',
        entityId: payment.orderId,
        afterData: {
          paymentId: payment.id,
          reference: payment.reference,
          status: failedStatus,
        },
      })

      const orderForRelease = await getPrisma().order.findUnique({
        where: { id: payment.orderId },
      })

      if (orderForRelease && orderForRelease.orderType === 'NORMAL') {
        releaseStock(payment.orderId).catch(err => {
          console.error('Failed to release stock for failed payment:', err)
        })
      }

      return NextResponse.json({ received: true })
    }

    const transactionResult = await getPrisma().$transaction(async (prisma: any) => {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          message: 'Payment successful via webhook',
        },
      })

      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'PROCESSING',
          paymentStatus: 'PAID',
        },
      })

      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: payment.orderId },
        include: {
          product: {
            include: {
              store: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      })

      let grossAmount = 0
      for (const item of orderItems) {
        grossAmount += item.price * item.quantity
      }

      const paystackFees = paystackResponse.data?.fees != null ? paystackResponse.data.fees / 100 : null
      const isFallback = paystackFees === null || paystackFees === undefined || paystackFees <= 0
      let processorFee = resolveProcessorFee(paystackFees, grossAmount)

      if (isFallback) {
        console.warn('[Payment Webhook] Paystack fees missing or zero for reference:', reference, '- using estimated 2% fallback (GHS', grossAmount.toFixed(2), '-> GHS', processorFee.toFixed(2), ')')
      }

      const financialBreakdown = calculateFinancialBreakdown(grossAmount, processorFee)

      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          grossAmount: financialBreakdown.grossAmount,
          processorFee: financialBreakdown.processorFee,
          netAmount: financialBreakdown.netAmount,
          platformCommission: financialBreakdown.platformCommission,
          vendorEarnings: financialBreakdown.vendorEarnings,
          commissionRate: financialBreakdown.commissionRate,
          total: grossAmount,
        },
      })

      for (const item of orderItems) {
        const itemGross = item.price * item.quantity
        let itemProcessorFee: number | null = null
        if (processorFee !== null && grossAmount > 0) {
          itemProcessorFee = (itemGross / grossAmount) * processorFee
        }

        const itemFinancialBreakdown = calculateFinancialBreakdown(
          itemGross,
          itemProcessorFee
        )

        await prisma.orderItem.update({
          where: { id: item.id },
          data: {
            grossAmount: itemFinancialBreakdown.grossAmount,
            processorFee: itemFinancialBreakdown.processorFee,
            netAmount: itemFinancialBreakdown.netAmount,
            platformCommission: itemFinancialBreakdown.platformCommission,
            vendorEarnings: itemFinancialBreakdown.vendorEarnings,
            commissionRate: itemFinancialBreakdown.commissionRate,
          },
        })
      }

      return { orderItems }
    })

    const order = await getPrisma().order.findUnique({
      where: { id: payment.orderId },
    })

    if (order && order.orderType === 'NORMAL') {
      const reservationItems = transactionResult.orderItems
        .filter((item: any) => item.availabilityType === 'IN_STOCK' || !item.availabilityType)
        .map((item: any) => ({
          productId: item.productId,
          productVariantId: item.productVariantId || undefined,
          quantity: item.quantity,
          availabilityType: (item.availabilityType || 'IN_STOCK') as 'IN_STOCK' | 'PREORDER' | 'BACKORDER',
        }))

      if (reservationItems.length > 0) {
        await reserveStock(payment.orderId, reservationItems)
      }
    }

    recordFulfillmentEvent(payment.orderId, 'PAYMENT_CONFIRMED').catch(err => {
      console.error('Failed to record payment confirmed event:', err)
    })

    await createAuditLog({
      userId: payment.userId,
      userRole: 'SYSTEM',
      action: 'PAYMENT_CONFIRMED',
      entityType: 'ORDER',
      entityId: payment.orderId,
      afterData: {
        paymentId: payment.id,
        reference: payment.reference,
        amount: payment.amount,
      },
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing payment webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
