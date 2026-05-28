import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { verifyPaystackPayment } from '@/lib/paystack'
import { sendPaymentConfirmationEmail } from '@/lib/email'
import { calculateFinancialBreakdown, formatFinancialBreakdown } from '@/lib/revenue'

// PRODUCTION RUNTIME HARDENING
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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
       // Payment failed, abandoned, or cancelled - mark as failed/cancelled
       const isAbandoned = paymentStatus === 'abandoned'
       const failedStatus = isAbandoned ? 'CANCELLED' : 'FAILED'
       
       console.log('[Payment Verify API] Payment not successful - status:', paymentStatus, 'marking as:', failedStatus)
       
       await getPrisma().$transaction(async (prisma: any) => {
         // Update payment status to FAILED or CANCELLED
         await prisma.payment.update({
           where: { id: payment.id },
           data: {
             status: failedStatus,
             message: isAbandoned ? 'Payment abandoned by user' : paymentStatus || 'Payment verification failed',
           },
         })

         // Update order payment status to match
         await prisma.order.update({
           where: { id: payment.orderId },
           data: {
             paymentStatus: failedStatus,
             status: 'CANCELLED', // Also cancel the order
           },
         })
       })

       return NextResponse.json({
         success: false,
         error: isAbandoned ? 'Payment was cancelled' : 'Payment verification failed',
       }, { status: 400 })
    }

    // Payment was successful - update payment and order status, and calculate financials
    console.log('[Payment Verify API] Payment successful - processing order')
    
    await getPrisma().$transaction(async (prisma: any) => {
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

        // Determine processor fee from Paystack response (if available)
        // Note: The current Paystack verification response does not include fee details.
        // We'll set processorFee to null if not available.
        let processorFee: number | null = null
        // If Paystack response includes fee, we would use it. For now, we leave it null.
        // Example: if (paystackResponse.data.fee) { processorFee = paystackResponse.data.fee / 100; }

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
            // Keep existing total field for backward compatibility (optional)
            total: grossAmount, // Assuming total should reflect gross amount
          },
        })

        // Update each order item with financials
        for (const item of orderItems) {
          const itemGross = item.price * item.quantity
          // Estimate processor fee per item apportioned by gross amount (if fee known)
          let itemProcessorFee: number | null = null
          if (processorFee !== null && grossAmount > 0) {
            itemProcessorFee = (itemGross / grossAmount) * processorFee
          }
          
          // Calculate item-level financials using centralized logic
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

        // Deduct stock for the order items
        for (const item of orderItems) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
          })

          if (product && product.stock >= item.quantity) {
            await prisma.product.update({
              where: { id: item.productId },
              data: { stock: product.stock - item.quantity },
            })
          }
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
      })

    // Send payment confirmation email (non-blocking)
    const user = await getPrisma().user.findUnique({
      where: { id: payload.userId },
      include: { profile: true },
    })
    if (user) {
      const customerName = user.profile?.firstName || user.email.split('@')[0] || 'Customer'
      sendPaymentConfirmationEmail(user.email, customerName, payment.orderId, payment.amount, payment.currency).catch(err => {
        console.error('Failed to send payment confirmation email:', err)
      })

       // Create in-app notification - with idempotency check to prevent duplicates
       // Only create if one doesn't already exist for this payment
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