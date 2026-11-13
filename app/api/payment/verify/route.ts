import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { verifyPaystackPayment } from '@/lib/paystack'
import { sendPaymentConfirmationEmail } from '@/lib/email'
import { canSendCustomerEmail, shouldSendNotification } from '@/lib/notification-preferences'
import { calculateFinancialBreakdown, formatFinancialBreakdown } from '@/lib/revenue'
import { reserveStock, releaseStock } from '@/lib/stock-reservation'
import { handleLatePayment } from '@/lib/late-payment'
import { checkPaystackAmount } from '@/lib/payment-checks'
import { createRefund } from '@/lib/refunds/refund-service'
import { createNotification } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit-log'

// PRODUCTION RUNTIME HARDENING
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Rate limiting - security hardening
  const rateLimitCheck = rateLimit('payment-verification')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  console.log('[Payment Verify API] Request received')
  
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      console.log('[Payment Verify API] No token found - Unauthorized')
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      console.log('[Payment Verify API] Invalid token - Unauthorized')
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      response.cookies.set('token', '', { expires: new Date(0), path: '/' })
      return response
    }

    const payload = outcome

    const { reference } = await request.json()
    console.log('[Payment Verify API] Reference received:', reference)

    if (!reference) {
      return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 })
    }

    // Find the payment record
    const payment = await getPrisma().payment.findUnique({
      where: { reference },
      // Only the fields the answer below uses are selected: an `include` would
      // load every column of the order, the delivery cost of the vendor's
      // rider included.
      select: {
        id: true,
        userId: true,
        amount: true,
        currency: true,
        status: true,
        orderId: true,
        reference: true,
        order: { select: { status: true } },
      },
    })

    if (!payment) {
      console.log('[Payment Verify API] Payment not found for reference:', reference)
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (payment.userId !== payload.userId) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Verify the payment with Paystack
    console.log('[Payment Verify API] Paystack verification started for reference:', reference)
    
    let paystackResponse
    try {
      paystackResponse = await verifyPaystackPayment(reference)
      console.log('[Payment Verify API] Paystack response received - status:', paystackResponse.data.status)
    } catch (verifyError) {
      console.error('[Payment Verify API] Paystack verification error:', verifyError)
      return NextResponse.json({ 
        error: verifyError instanceof Error ? verifyError.message : 'Failed to verify payment with Paystack' 
      }, { status: 500 })
    }

    // Check both Paystack status and our payment status
    const paymentStatus = paystackResponse.data.status

    // Amount and currency validation against Paystack's charged amount.
    // payment.amount is chargeTotal (checkout/route.ts:302), exactly what is
    // sent to Paystack (lib/paystack.ts:127). A mismatch indicates an error,
    // never a legitimate wallet/discount/fee variation.
    if (paymentStatus === 'success') {
      const amountCheck = checkPaystackAmount(paystackResponse.data, payment)
      if (amountCheck.wrongCurrency || amountCheck.underpaid) {
        // Mark payment PAID (customer did pay) for idempotency on repeat calls.
        await getPrisma().payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            message: `Amount mismatch - ${amountCheck.wrongCurrency ? 'wrong currency' : 'underpaid'}`,
            paystackRef: payment.reference,
          },
        })
        // Cancel the order and release any reserved stock.
        await getPrisma().order.update({
          where: { id: payment.orderId },
          data: { status: 'CANCELLED', paymentStatus: 'PAID' },
        })
        const orderForRelease = await getPrisma().order.findUnique({
          where: { id: payment.orderId },
          select: { orderType: true },
        })
        if (orderForRelease && orderForRelease.orderType === 'NORMAL') {
          await releaseStock(payment.orderId).catch(err => {
            console.error('Failed to release stock for amount mismatch:', err)
          })
        }

        if (amountCheck.wrongCurrency) {
          // Wrong currency: do not auto-refund. Mark needs-attention and
          // notify super admins with the reference, paid amount, and currency.
          const superAdmins = await getPrisma().user.findMany({
            where: { role: 'SUPER_ADMIN' },
            select: { id: true },
          })
          for (const admin of superAdmins) {
            await createNotification(
              admin.id,
              'ORDER_STATUS_UPDATED',
              'Wrong currency payment needs review',
              `Order ${payment.orderId} received ${amountCheck.paystackAmountGhs} ${paystackResponse.data.currency} but expected ${amountCheck.storedAmountGhs} ${payment.currency}. Reference: ${payment.reference}`,
            ).catch(() => {})
          }
          return NextResponse.json({
            success: false,
            orderId: payment.orderId,
            error: 'Payment currency mismatch',
            amountCheck,
          }, { status: 400 })
        }

        // Underpaid, correct currency: refund exactly the amount Paystack
        // received, then cancel and release stock.
        try {
          const orderItems = await getPrisma().orderItem.findMany({
            where: { orderId: payment.orderId },
            select: { id: true, price: true, quantity: true },
          })
          const remainingPesewas = Math.round(amountCheck.paystackAmountGhs * 100)
          const refundItems: Array<{ orderItemId: string; amount: number }> = []
          let remaining = remainingPesewas
          for (const item of orderItems) {
            if (remaining <= 0) break
            const itemGrossPesewas = Math.round((item.price ?? 0) * item.quantity * 100)
            const amountPesewas = Math.min(itemGrossPesewas, remaining)
            if (amountPesewas > 0) {
              refundItems.push({ orderItemId: item.id, amount: amountPesewas / 100 })
              remaining -= amountPesewas
            }
          }
          if (refundItems.length > 0) {
            await createRefund({
              orderId: payment.orderId,
              items: refundItems,
              source: 'CUSTOMER_CANCEL',
              reference: payment.reference,
              actor: {
                triggeredByUserId: payment.userId,
                triggeredByRole: 'SYSTEM',
              },
            })
          }
        } catch (refundErr) {
          // Refund could not be started - notify admins for manual review.
          const superAdmins = await getPrisma().user.findMany({
            where: { role: 'SUPER_ADMIN' },
            select: { id: true },
          })
          for (const admin of superAdmins) {
            await createNotification(
              admin.id,
              'ORDER_STATUS_UPDATED',
              'Underpaid refund needs manual review',
              `Order ${payment.orderId} was underpaid by Paystack and the automatic refund could not be started. Reference: ${payment.reference}`,
            ).catch(() => {})
          }
        }
        return NextResponse.json({
          success: false,
          orderId: payment.orderId,
          error: 'Payment amount mismatch',
          amountCheck,
        }, { status: 400 })
      }
      if (amountCheck.overpaid) {
        const superAdmins = await getPrisma().user.findMany({
          where: { role: 'SUPER_ADMIN' },
          select: { id: true },
        })
        for (const admin of superAdmins) {
          await createNotification(
            admin.id,
            'ORDER_STATUS_UPDATED',
            'Payment overpaid',
            `Order ${payment.orderId} was overpaid: Paystack charged ${amountCheck.paystackAmountGhs} GHS, expected ${amountCheck.storedAmountGhs} GHS. Reference: ${payment.reference}`,
          ).catch(() => {})
        }
      }
    }
    
    // CRITICAL: Early return if payment already verified (idempotency protection)
    // This prevents double stock deduction, double order processing, and double notifications
    if (payment.status === 'PAID') {
      // Payment already processed - return success without re-processing
      console.log('[Payment Verify API] Payment already processed - returning success')
      return NextResponse.json({
        success: true,
        orderId: payment.orderId,
        message: 'Payment already verified',
        alreadyProcessed: true,
      })
    }

    // Late payment: order was cancelled by the expiry cron but Paystack
    // confirms the transaction succeeded. Attempt to fulfil or refund.
    if (payment.order?.status === 'CANCELLED' && payment.status === 'FAILED' && paymentStatus === 'success') {
      const late = await handleLatePayment(payment.orderId, payment.reference, paystackResponse.data)
      return NextResponse.json({
        success: late.fulfilled,
        orderId: payment.orderId,
        message: 'Late payment processed',
        alreadyProcessed: late.alreadyProcessed,
        latePayment: late,
      })
    }

    if (payment.order?.status !== 'PENDING') {
      // Payment already processed - return success without re-processing
      console.log('[Payment Verify API] Payment already processed - returning success')
      return NextResponse.json({
        success: true,
        orderId: payment.orderId,
        message: 'Payment already verified',
        alreadyProcessed: true,
      })
    }
    
// Check if payment was abandoned, cancelled, or failed
    if (paymentStatus !== 'success') {
       // Payment failed, abandoned, or cancelled - mark as failed/cancelled and release any reserved stock
       const isAbandoned = paymentStatus === 'abandoned'
       const isCancelled = paymentStatus === 'cancelled'
       const failedStatus = isAbandoned || isCancelled ? 'CANCELLED' : 'FAILED'

       console.log('[Payment Verify API] Payment not successful - status:', paymentStatus, 'marking as:', failedStatus)

       await getPrisma().$transaction(async (prisma: any) => {
         // Update payment status to FAILED or CANCELLED
         await prisma.payment.update({
           where: { id: payment.id },
           data: {
             status: failedStatus,
             message: isAbandoned ? 'Payment abandoned by user' : isCancelled ? 'Payment cancelled by user' : paymentStatus || 'Payment verification failed',
           },
         })

         // Update order payment status to match
         await prisma.order.update({
           where: { id: payment.orderId },
           data: {
             paymentStatus: failedStatus,
             status: 'CANCELLED',
           },
         })
       })

       // Release reserved stock for NORMAL orders (must run after transaction commits)
        const orderForRelease = await getPrisma().order.findUnique({
          where: { id: payment.orderId },
          select: { orderType: true },
        })

       if (orderForRelease && orderForRelease.orderType === 'NORMAL') {
         releaseStock(payment.orderId).catch(err => {
           console.error('Failed to release stock for failed payment:', err)
         })
       }

       return NextResponse.json({
         success: false,
         status: paymentStatus,
         orderId: payment.orderId,
         error: isAbandoned || isCancelled ? 'Payment was cancelled' : 'Payment verification failed',
       }, { status: 400 })
     }

    // Payment was successful - update payment and order status, and calculate financials
    console.log('[Payment Verify API] Payment successful - processing order')
    
    const transactionResult = await getPrisma().$transaction(async (prisma: any) => {
        // Update payment status to PAID
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            message: 'Payment successful',
          },
        })

        // Update order status to PROCESSING (order is now active)
        await prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'PROCESSING',
            paymentStatus: 'PAID',
          },
        })

        // Fetch order items to calculate financials
        const orderItems = await prisma.orderItem.findMany({
          where: { orderId: payment.orderId },
          // Every field is selected on purpose: an `include` would load every
          // column of the line and of its product, the cost price of the
          // vendor and the cost snapshot of the line included.
          select: {
            id: true,
            productId: true,
            productVariantId: true,
            quantity: true,
            price: true,
            availabilityType: true,
            product: { select: { storeId: true } },
          },
        })

      // Calculate gross amount from order items (original order total)
      let grossAmount = 0
      for (const item of orderItems) {
        grossAmount += item.price * item.quantity
      }

      // Actual charged amount from Paystack (includes passed-through processing fee)
      const actualChargedAmount = paystackResponse.data.amount / 100

      // Processor fee is the difference between what customer paid and original order total
      const processorFee = Math.max(0, Math.round((actualChargedAmount - grossAmount) * 100) / 100)

      // Financial breakdown: fee is pass-through, so commission/earnings stay on original total
      const financialBreakdown = await calculateFinancialBreakdown(grossAmount, 0)

        // Update order with financial totals
        await prisma.order.update({
          where: { id: payment.orderId },
          data: {
            grossAmount: actualChargedAmount,
            processorFee: processorFee,
            netAmount: financialBreakdown.netAmount,
            platformCommission: financialBreakdown.platformCommission,
            vendorEarnings: financialBreakdown.vendorEarnings,
            commissionRate: financialBreakdown.commissionRate,
            total: grossAmount,
          },
        })

        // Update each order item with financials
        for (const item of orderItems) {
          const itemGross = item.price * item.quantity
          const itemProcessorFee = Math.round((itemGross / grossAmount) * processorFee * 100) / 100
          
          const itemFinancialBreakdown = await calculateFinancialBreakdown(
            itemGross,
            0
          )

          await prisma.orderItem.update({
            where: { id: item.id },
            data: {
              grossAmount: itemFinancialBreakdown.grossAmount,
              processorFee: itemProcessorFee,
              netAmount: itemFinancialBreakdown.netAmount,
              platformCommission: itemFinancialBreakdown.platformCommission,
              vendorEarnings: itemFinancialBreakdown.vendorEarnings,
              commissionRate: itemFinancialBreakdown.commissionRate,
            },
          })
        }

        // Clear the user's cart after successful payment
        const cart = await prisma.cart.findUnique({
          where: { userId: payload.userId },
        })
        if (cart) {
          await prisma.cartItem.deleteMany({
            where: { cartId: cart.id },
          })
        }

        return { orderItems }
      })

    // Reserve stock for NORMAL orders only (outside transaction to avoid long locks)
    const order = await getPrisma().order.findUnique({
      where: { id: payment.orderId },
      select: { orderType: true, userId: true },
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

    try {
      const { checkAndQualifyInfluencerReferral } = await import('@/lib/influencer/qualification-service')
      if (order?.userId) {
        await checkAndQualifyInfluencerReferral(order.userId)
      }
    } catch (qualifyError) {
      console.error('Influencer qualification check failed after payment:', qualifyError)
    }

    // Send payment confirmation email (non-blocking)
    const user = await getPrisma().user.findUnique({
      where: { id: payload.userId },
      include: { profile: true },
    })
    if (user) {
      const customerName = user.profile?.firstName || user.email.split('@')[0] || 'Customer'
      if (await canSendCustomerEmail(user.id)) {
        sendPaymentConfirmationEmail(user.email, customerName, payment.orderId, payment.amount, payment.currency).catch(err => {
          console.error('Failed to send payment confirmation email:', err)
        })
      }

      // Create in-app notification - with idempotency check to prevent duplicates
      if (await shouldSendNotification(user.id, 'PAYMENT_SUCCESSFUL')) {
        const existingNotification = await getPrisma().notification.findFirst({
         where: {
           userId: user.id,
           type: 'PAYMENT_SUCCESSFUL',
           message: {
             contains: payment.orderId.slice(0, 8),
           },
         },
        })
        if (!existingNotification) {
          await getPrisma().notification.create({
            data: {
              userId: user.id,
              type: 'PAYMENT_SUCCESSFUL',
              title: 'Payment Successful',
              message: `Your payment of GHS ${payment.amount.toFixed(2)} for order #${payment.orderId.slice(0, 8)} has been confirmed.`,
            },
          }).catch((err: any) => {
            console.error('Failed to create notification:', err)
          })
        }
      }

      // Notify vendors that payment was successful and order is confirmed
      const orderItems = transactionResult.orderItems
      const vendorStoreIds = Array.from(new Set(orderItems.map((item: any) => item.product?.storeId).filter(Boolean))) as string[]
     for (const storeId of vendorStoreIds) {
       const store = await getPrisma().store.findUnique({
         where: { id: storeId },
         select: { userId: true }
       })
       if (store?.userId && (await shouldSendNotification(store.userId, 'ORDER_STATUS_UPDATED'))) {
         await getPrisma().notification.create({
           data: {
             userId: store.userId,
             type: 'ORDER_STATUS_UPDATED',
             title: 'Order Payment Confirmed',
             message: `Payment received for order #${payment.orderId.slice(0, 8)}. Please prepare items for fulfillment.`,
           },
         }).catch((err: any) => {
           console.error('Failed to create vendor payment notification:', err)
         })
       }
     }
    }

    console.log('[Payment Verify API] Payment verified successfully for order:', payment.orderId)
    
    return NextResponse.json({
      success: true,
      orderId: payment.orderId,
      message: 'Payment verified successfully',
    })
  } catch (error) {
    console.error('[Payment Verify API] Error verifying payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}