import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyPaystackPayment } from '@/lib/paystack'
import { calculateFinancialBreakdown } from '@/lib/revenue'

// This endpoint is called by Paystack after a payment attempt
// It serves as a webhook for payment status updates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const reference = body.data?.reference

    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 })
    }

    // Find the payment record
    const payment = await getPrisma().payment.findUnique({
      where: { reference },
      include: {
        order: true,
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Verify the payment with Paystack
    const paystackResponse = await verifyPaystackPayment(reference)
    const paymentStatus = paystackResponse.data.status

    // CRITICAL: Early return if payment already verified (idempotency protection)
    // This prevents double stock deduction, double order processing, and double notifications
    if (payment.status === 'PAID' || payment.order?.status !== 'PENDING') {
      // Payment already processed - acknowledge without re-processing
      return NextResponse.json({ received: true, alreadyProcessed: true })
    }

    // Check if payment was abandoned, cancelled, or failed
    if (paymentStatus !== 'success') {
      // Payment failed, abandoned, or cancelled
      const isAbandoned = paymentStatus === 'abandoned'
      const failedStatus = isAbandoned ? 'CANCELLED' : 'FAILED'
      
       await getPrisma().$transaction(async (prisma: any) => {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: failedStatus,
              message: isAbandoned ? 'Payment abandoned via webhook' : 'Payment failed via webhook',
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

      return NextResponse.json({ received: true })
    }

     // Payment was successful - update payment and order status, and calculate financials
     await getPrisma().$transaction(async (prisma: any) => {
         // Update payment status to PAID
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            message: 'Payment successful via webhook',
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
      })

      return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing payment webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}