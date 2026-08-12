import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { verifyPaystackPayment } from '@/lib/paystack'
import { sendPaymentConfirmationEmail } from '@/lib/email'
import { canSendCustomerEmail, shouldSendNotification } from '@/lib/notification-preferences'
import { calculateFinancialBreakdown, formatFinancialBreakdown, resolveProcessorFee } from '@/lib/revenue'
import { reserveStock, releaseStock } from '@/lib/stock-reservation'
import { rateLimit } from '@/lib/rate-limit'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      console.log('[Payment Verify API] Invalid token - Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reference } = await request.json()
    console.log('[Payment Verify API] Reference received:', reference)

    if (!reference) {
      return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 })
    }

    // Find the payment record
    const payment = await getPrisma().payment.findUnique({
      where: { reference },
      include: {
        order: true,
      },
    })

    if (!payment) {
      console.log('[Payment Verify API] Payment not found for reference:', reference)
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
    
    // CRITICAL: Early return if payment already verified (idempotency protection)
    // This prevents double stock deduction, double order processing, and double notifications
    if (payment.status === 'PAID' || payment.order?.status !== 'PENDING') {
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

      // Calculate gross amount from order items
      let grossAmount = 0
      for (const item of orderItems) {
        grossAmount += item.price * item.quantity
      }

      // Determine processor fee from Paystack response (actual fees or fallback)
      const paystackFees = paystackResponse.data?.fees != null ? paystackResponse.data.fees / 100 : null
      const isFallback = paystackFees === null || paystackFees === undefined || paystackFees <= 0
      let processorFee = resolveProcessorFee(paystackFees, grossAmount)

      if (isFallback) {
        console.warn('[Payment Verify API] Paystack fees missing or zero for reference:', reference, '- using estimated 2% fallback (GHS', grossAmount.toFixed(2), '-> GHS', processorFee.toFixed(2), ')')
      }

      // Use centralized revenue calculation logic
      const financialBreakdown = calculateFinancialBreakdown(grossAmount, processorFee)

        // Update order with financial totals
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

        // Update each order item with financials
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