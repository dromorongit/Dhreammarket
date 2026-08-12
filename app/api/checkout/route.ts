import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { initializePaystackPayment, isPaystackConfigured } from '@/lib/paystack'
import { sendOrderConfirmationEmail } from '@/lib/email'
import { canSendCustomerEmail } from '@/lib/notification-preferences'
import { createNotification, formatNotificationMessage } from '@/lib/notifications'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import crypto from 'crypto'
import { rateLimit } from '@/lib/rate-limit'

// PRODUCTION RUNTIME HARDENING
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL

  // Rate limiting - security hardening
  const rateLimitCheck = rateLimit('checkout')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  console.log('[Checkout API] Request received')
  
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      console.log('[Checkout API] No token found - Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      console.log('[Checkout API] Invalid token - Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if Paystack is configured
    if (!isPaystackConfigured()) {
      console.error('[Checkout API] CRITICAL: Paystack not configured - PAYSTACK_SECRET_KEY missing or placeholder')
      return NextResponse.json({ 
        error: 'Payment system not configured. Please contact support.' 
      }, { status: 500 })
    }

    // Get user's cart with variants
    const cart = await getPrisma().cart.findUnique({
      where: { userId: payload.userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                store: true,
              },
            },
            productVariant: true,
          },
        },
      },
    })

    if (!cart || cart.items.length === 0) {
      console.log('[Checkout API] Cart is empty for user:', payload.userId)
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    // Validate stock for all items (variant stock takes precedence)
    // Preorder and Backorder products skip stock validation
    for (const item of cart.items) {
      const isPreorderOrBackorder = item.product.availabilityType === 'PREORDER' || 
                                     item.product.availabilityType === 'BACKORDER'
      if (isPreorderOrBackorder) {
        continue // Skip stock validation for preorder/backorder items
      }
      const availableStock = item.productVariant?.stock ?? item.product.stock
      if (availableStock < item.quantity) {
        console.log('[Checkout API] Insufficient stock for:', item.product.name)
        return NextResponse.json({
          error: `Insufficient stock for ${item.product.name}. Available: ${availableStock}`
        }, { status: 400 })
      }
    }

    // Parse customer and shipping info from request
    const { customerInfo, shippingInfo, idempotencyKey } = await request.json()

    // Idempotency: check for recent duplicate checkout attempts
    const effectiveIdempotencyKey = idempotencyKey || crypto.randomUUID()
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    const recentOrder = await getPrisma().order.findFirst({
      where: {
        userId: payload.userId,
        idempotencyKey: effectiveIdempotencyKey,
        createdAt: { gte: tenMinutesAgo },
      },
      include: { payment: true },
    })

    if (recentOrder) {
      console.log('[Checkout API] Idempotent request detected - returning existing order:', recentOrder.id)
      return NextResponse.json({
        orderId: recentOrder.id,
        paymentId: recentOrder.payment?.id,
        reference: recentOrder.payment?.reference,
        authorizationUrl: recentOrder.payment?.paystackRef
          ? `${appUrl}/checkout?reference=${recentOrder.payment.reference}`
          : undefined,
        pricing: {
          subtotal: recentOrder.subtotal ?? 0,
          shipping: recentOrder.shipping ?? 0,
          tax: recentOrder.tax ?? 0,
          total: recentOrder.total,
        },
        vendorBreakdown: {},
        idempotent: true,
      })
    }

    // Calculate subtotal
    const subtotal = cart.items.reduce(
      (sum: number, item: any) => sum + (item.product.price * item.quantity), 
      0
    )
    
    // Shipping and tax are always 0 as per business rules
    // Delivery fees are negotiated separately by vendors and delivery partners
    const shippingPrice = 0
    const tax = 0
    const total = subtotal

    // Generate unique reference for the payment
    const reference = `DHV-${crypto.randomBytes(8).toString('hex').toUpperCase()}`

    // Get user's email for Paystack
    const user = await getPrisma().user.findUnique({
      where: { id: payload.userId },
      select: { email: true },
    })

    if (!user) {
      console.log('[Checkout API] User not found:', payload.userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create vendor breakdown for marketplace settlement
    const vendorBreakdown: Record<string, { items: any[], subtotal: number, earnings: number }> = {}
    for (const item of cart.items) {
      const storeId = item.product.storeId
      if (!vendorBreakdown[storeId]) {
        vendorBreakdown[storeId] = { items: [], subtotal: 0, earnings: 0 }
      }
      vendorBreakdown[storeId].items.push({
        productId: item.productId,
        quantity: item.quantity,
        price: item.product.price,
        color: item.color,
        size: item.size,
        age: item.age,
      })
      vendorBreakdown[storeId].subtotal += item.product.price * item.quantity
    }

    // Calculate vendor earnings (90% of item value, 10% platform commission)
    for (const storeId in vendorBreakdown) {
      vendorBreakdown[storeId].earnings = Math.round(vendorBreakdown[storeId].subtotal * 0.9 * 100) / 100
    }

// Determine order type and fulfillment status based on product availability
     let orderType = 'NORMAL'
     let fulfillmentStatus = 'PENDING'
     const hasPreorder = cart.items.some((item: any) => 
       item.product.availabilityType === 'PREORDER'
     )
     const hasBackorder = cart.items.some((item: any) => 
       item.product.availabilityType === 'BACKORDER'
     )

     if (hasPreorder) {
       orderType = 'PREORDER'
       fulfillmentStatus = 'AWAITING_STOCK'
     } else if (hasBackorder) {
       orderType = 'BACKORDER'
       fulfillmentStatus = 'AWAITING_RESTOCK'
     }

// Create order and payment record in a transaction
      const orderData: any = {
        userId: payload.userId,
        total,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        orderType,
        fulfillmentStatus,
        idempotencyKey: effectiveIdempotencyKey,
        // Store customer info
       customerFirstName: customerInfo?.firstName || '',
       customerLastName: customerInfo?.lastName || '',
       customerEmail: customerInfo?.email || user.email,
       customerPhone: customerInfo?.phone || '',
       customerAddress: customerInfo?.address || '',
       customerCity: customerInfo?.city || '',
       customerRegion: customerInfo?.region || '',
       // Store shipping info
       shippingZone: shippingInfo?.zone || 'Other Locations',
       shippingDaysMin: shippingInfo?.estimatedDays?.min || 3,
       shippingDaysMax: shippingInfo?.estimatedDays?.max || 7,
     }
    
    try {
      orderData.subtotal = subtotal
      orderData.shipping = shippingPrice
      orderData.tax = tax
    } catch (e) {
      console.log('[Checkout API] Optional fields not available in database schema')
    }
    
    let result: { order: any; payment: any }
    try {
      result = await getPrisma().$transaction(async (prisma: any) => {
        const order = await prisma.order.create({
          data: orderData,
        })

        // Create payment record
        const payment = await prisma.payment.create({
          data: {
            userId: payload.userId,
            orderId: order.id,
            amount: total,
            currency: 'GHS',
            status: 'PENDING',
            reference,
          },
        })

// Create order items with variant information and snapshots
         for (const item of cart.items) {
           await prisma.orderItem.create({
             data: {
               orderId: order.id,
               productId: item.productId,
               productVariantId: item.productVariantId || null,
               quantity: item.quantity,
               price: item.product.price,
               color: item.color || null,
               size: item.size || null,
               age: item.age || null,
               // Snapshot fulfillment data at purchase time
               availabilityType: item.product.availabilityType,
               expectedArrivalDate: item.product.expectedArrivalDate || null,
               expectedRestockDate: item.product.expectedRestockDate || null,
             },
           })
         }

        return { order, payment }
      })
    } catch (dbError) {
      console.error('[Checkout API] Database error creating order:', dbError)
      return NextResponse.json({ 
        error: `Database error: ${dbError instanceof Error ? dbError.message : 'Failed to create order'}` 
      }, { status: 500 })
    }

    // Initialize Paystack payment
    const callbackUrl = `${appUrl}/checkout?reference=${reference}`
    console.log('[Checkout API] Paystack initialization started - reference:', reference, 'callbackUrl:', callbackUrl)

    if (!appUrl) {
      console.error('[Checkout API] CRITICAL ERROR: APP_URL is not configured. Set NEXT_PUBLIC_APP_URL or APP_URL environment variable.')
    }

    try {
      const paystackResponse = await initializePaystackPayment(
        user.email,
        total,
        reference,
        callbackUrl,
        {
          orderId: result.order.id,
          userId: payload.userId,
          vendorBreakdown,
        }
      )

      console.log('[Checkout API] Paystack response received - authorization_url:', paystackResponse.data.authorization_url)

      // Update payment with Paystack reference
      await getPrisma().payment.update({
        where: { id: result.payment.id },
        data: { paystackRef: paystackResponse.data.reference },
      })

      // Send order confirmation email (non-blocking, don't fail if email fails)
      const userProfile = await getPrisma().profile.findUnique({
        where: { userId: payload.userId },
      })
      const customerName = userProfile?.firstName || user?.email.split('@')[0] || 'Customer'
      if (await canSendCustomerEmail(payload.userId)) {
        sendOrderConfirmationEmail(user.email, customerName, result.order.id, total, 'GHS').catch(err => {
          console.error('Failed to send order confirmation email:', err)
        })
      }

// Create in-app notification for customer
        createNotification(payload.userId, 'ORDER_PLACED', 'Order Placed', `Your order #${result.order.id.slice(0, 8)} has been placed. Total: GHS ${total.toFixed(2)}`).catch(err => {
          console.error('Failed to create notification:', err)
        })

        // Notify vendors about new orders
        const vendorStores = new Set<string>()
        for (const item of cart.items) {
          vendorStores.add(item.product.storeId)
        }
        const vendorStoreIds = Array.from(vendorStores)
        for (const storeId of vendorStoreIds) {
          const store = await getPrisma().store.findUnique({
            where: { id: storeId },
            select: { userId: true }
          })
          if (store?.userId) {
            createNotification(store.userId, 'ORDER_PLACED', 'New Order Received', `New order #${result.order.id.slice(0, 8)} received. Total: GHS ${total.toFixed(2)}`).catch(err => {
              console.error('Failed to create vendor notification:', err)
            })
          }
        }

        // Record fulfillment events
       if (orderType === 'PREORDER') {
         const firstItem = cart.items[0]
         recordFulfillmentEvent(result.order.id, 'PREORDER_PLACED', payload.userId, {
           productName: firstItem?.product?.name,
         }).catch(err => console.error('Failed to record preorder event:', err))
       } else if (orderType === 'BACKORDER') {
         const firstItem = cart.items[0]
         recordFulfillmentEvent(result.order.id, 'BACKORDER_PLACED', payload.userId, {
           productName: firstItem?.product?.name,
         }).catch(err => console.error('Failed to record backorder event:', err))
       }

      return NextResponse.json({
        orderId: result.order.id,
        paymentId: result.payment.id,
        reference,
        authorizationUrl: paystackResponse.data.authorization_url,
        pricing: {
          subtotal,
          shipping: shippingPrice,
          tax,
          total,
        },
        vendorBreakdown,
      })
    } catch (paystackError) {
      // If Paystack initialization fails, update payment status to FAILED
      console.error('[Checkout API] Paystack initialization error:', paystackError)
      
      await getPrisma().payment.update({
        where: { id: result.payment.id },
        data: { 
          status: 'FAILED',
          message: paystackError instanceof Error ? paystackError.message : 'Payment initialization failed',
        },
      })

      // Update order status
      await getPrisma().order.update({
        where: { id: result.order.id },
        data: { paymentStatus: 'FAILED' },
      })

      const errorMessage = paystackError instanceof Error ? paystackError.message : 'Failed to initialize payment'
      return NextResponse.json({ 
        error: `Failed to initialize payment: ${errorMessage}` 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[Checkout API] Error initializing checkout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}