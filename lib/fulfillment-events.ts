import { getPrisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import { formatNotificationMessage } from '@/lib/notifications'

export type FulfillmentEventType = 
  | 'ORDER_CREATED'
  | 'PAYMENT_CONFIRMED'
  | 'PREORDER_PLACED'
  | 'BACKORDER_PLACED'
  | 'STOCK_RECEIVED'
  | 'RESTOCK_RECEIVED'
  | 'READY_TO_FULFILL'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'STOCK_RESERVED'
  | 'STOCK_RELEASED'
  | 'STOCK_ADJUSTED'
  | 'INVENTORY_CONSUMED'
  | 'INVENTORY_ALLOCATED'
  | 'PROCUREMENT_ORDER_CREATED'
  | 'PROCUREMENT_SHIPPED'
  | 'PROCUREMENT_ARRIVED'
  | 'PROCUREMENT_INVENTORY_RECEIVED'

interface EventMetadata {
  productName?: string
  expectedDate?: string | Date | null
  customerName?: string
  customerEmail?: string
  vendorId?: string
  vendorEmail?: string
  createdByName?: string
  description?: string
}

const EVENT_TITLES: Record<FulfillmentEventType, string> = {
  ORDER_CREATED: 'Order Created',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  PREORDER_PLACED: 'Pre-order Placed',
  BACKORDER_PLACED: 'Backorder Placed',
  STOCK_RECEIVED: 'Stock Received',
  RESTOCK_RECEIVED: 'Restock Received',
  READY_TO_FULFILL: 'Ready to Fulfill',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  STOCK_RESERVED: 'Stock Reserved',
  STOCK_RELEASED: 'Stock Released',
  STOCK_ADJUSTED: 'Stock Adjusted',
  INVENTORY_CONSUMED: 'Inventory Consumed',
  INVENTORY_ALLOCATED: 'Inventory Allocated',
  PROCUREMENT_ORDER_CREATED: 'Procurement Order Created',
  PROCUREMENT_SHIPPED: 'Procurement Shipped',
  PROCUREMENT_ARRIVED: 'Procurement Arrived',
  PROCUREMENT_INVENTORY_RECEIVED: 'Procurement Inventory Received',
}

const EVENT_DESCRIPTIONS: Record<FulfillmentEventType, string> = {
  ORDER_CREATED: 'Your order has been created and is awaiting payment.',
  PAYMENT_CONFIRMED: 'Your payment has been confirmed. Order is now active.',
  PREORDER_PLACED: 'Your pre-order has been placed and is awaiting stock arrival.',
  BACKORDER_PLACED: 'Your backorder request has been received and is awaiting restock.',
  STOCK_RECEIVED: 'Pre-ordered item is now in stock.',
  RESTOCK_RECEIVED: 'Backordered item has been restocked.',
  READY_TO_FULFILL: 'Order is ready to be fulfilled.',
  PROCESSING: 'Order is being processed.',
  SHIPPED: 'Order has been shipped.',
  DELIVERED: 'Order has been delivered.',
  CANCELLED: 'Order has been cancelled.',
  REFUNDED: 'Order has been refunded and stock released.',
  STOCK_RESERVED: 'Stock has been reserved for your order.',
  STOCK_RELEASED: 'Reserved stock has been released.',
  STOCK_ADJUSTED: 'Stock reservation was manually adjusted.',
  INVENTORY_CONSUMED: 'Reserved inventory has been consumed for fulfilled items.',
  INVENTORY_ALLOCATED: 'Inventory has been allocated to your order.',
  PROCUREMENT_ORDER_CREATED: 'A procurement order has been created for this product.',
  PROCUREMENT_SHIPPED: 'The procurement order has been shipped by the supplier.',
  PROCUREMENT_ARRIVED: 'The procurement order has arrived at your location.',
  PROCUREMENT_INVENTORY_RECEIVED: 'Procurement inventory has been received and processed.',
}

const EMAIL_TEMPLATES: Record<FulfillmentEventType, { subject: string; message: string } | null> = {
  ORDER_CREATED: null,
  PAYMENT_CONFIRMED: null,
  PREORDER_PLACED: null,
  BACKORDER_PLACED: null,
  STOCK_RECEIVED: {
    subject: 'Your Preorder Item Has Arrived',
    message: 'Your pre-ordered item {productName} is now in stock and will be processed soon.',
  },
  RESTOCK_RECEIVED: {
    subject: 'Your Backorder Item Has Been Restocked',
    message: 'Your backordered item {productName} is now available.',
  },
  READY_TO_FULFILL: {
    subject: 'Order Ready for Fulfillment',
    message: 'Your order for {productName} is now ready to be fulfilled.',
  },
  PROCESSING: {
    subject: 'Your Order Has Been Shipped',
    message: 'Your order #{orderId} has been shipped.',
  },
  SHIPPED: {
    subject: 'Your Order Has Been Shipped',
    message: 'Your order #{orderId} has been shipped.',
  },
  DELIVERED: {
    subject: 'Your Order Has Been Delivered',
    message: 'Your order #{orderId} has been delivered.',
  },
  CANCELLED: null,
  REFUNDED: null,
  STOCK_RESERVED: null,
  STOCK_RELEASED: null,
  STOCK_ADJUSTED: null,
  INVENTORY_CONSUMED: null,
  INVENTORY_ALLOCATED: {
    subject: 'Inventory Allocated to Your Order',
    message: 'Inventory has been allocated to your order. Your item {productName} is now ready for fulfillment.',
  },
  PROCUREMENT_ORDER_CREATED: null,
  PROCUREMENT_SHIPPED: null,
  PROCUREMENT_ARRIVED: null,
  PROCUREMENT_INVENTORY_RECEIVED: null,
}

export async function recordFulfillmentEvent(
  orderId: string,
  eventType: FulfillmentEventType,
  createdBy?: string,
  metadata?: EventMetadata
) {
  try {
    if (!orderId) {
      console.log(`Stock adjustment recorded: ${eventType}`, metadata)
      return { eventType, title: EVENT_TITLES[eventType], description: metadata?.description }
    }

    const isRestockEvent = [
      'PROCUREMENT_ORDER_CREATED',
      'PROCUREMENT_SHIPPED',
      'PROCUREMENT_ARRIVED',
      'PROCUREMENT_INVENTORY_RECEIVED',
    ].includes(eventType)

    if (isRestockEvent) {
      const title = EVENT_TITLES[eventType]
      const description = metadata?.productName 
        ? `${metadata.productName} - ${EVENT_DESCRIPTIONS[eventType]}`
        : EVENT_DESCRIPTIONS[eventType]

      const event = await getPrisma().fulfillmentEvent.create({
        data: {
          orderId,
          eventType,
          title,
          description: metadata?.description || description,
          createdBy,
        },
      })

      if (createdBy && metadata?.vendorId) {
        await createNotification(
          metadata.vendorId,
          'RESTOCK_ORDER_CREATED',
          title,
          description
        ).catch(err => console.error('Failed to create notification:', err))
      }

      return event
    }

    const order = await getPrisma().order.findUnique({
      where: { id: orderId },
      include: {
        user: { include: { profile: true } },
        items: { include: { product: true } },
      },
    })

    if (!order) {
      console.error(`Order ${orderId} not found for fulfillment event ${eventType}`)
      return null
    }

    const title = EVENT_TITLES[eventType]
    const description = metadata?.productName 
      ? `${metadata.productName} - ${EVENT_DESCRIPTIONS[eventType]}`
      : EVENT_DESCRIPTIONS[eventType]

    const event = await getPrisma().fulfillmentEvent.create({
      data: {
        orderId,
        eventType,
        title,
        description: metadata?.description || description,
        createdBy,
      },
    })

    await sendEventNotification(order, eventType, metadata)

    await sendEventEmailIfNeeded(order, eventType, metadata)

    return event
  } catch (error) {
    console.error('Error recording fulfillment event:', error)
    return null
  }
}

async function sendEventNotification(
  order: any,
  eventType: FulfillmentEventType,
  metadata?: EventMetadata
) {
  const notificationTypeMap: Record<FulfillmentEventType, string> = {
    ORDER_CREATED: 'ORDER_PLACED',
    PAYMENT_CONFIRMED: 'PAYMENT_SUCCESSFUL',
    PREORDER_PLACED: 'ORDER_PLACED',
    BACKORDER_PLACED: 'ORDER_PLACED',
    STOCK_RECEIVED: 'ORDER_STATUS_UPDATED',
    RESTOCK_RECEIVED: 'ORDER_STATUS_UPDATED',
    READY_TO_FULFILL: 'ORDER_STATUS_UPDATED',
    PROCESSING: 'ORDER_STATUS_UPDATED',
    SHIPPED: 'ORDER_STATUS_UPDATED',
    DELIVERED: 'ORDER_STATUS_UPDATED',
    CANCELLED: 'ORDER_STATUS_UPDATED',
    REFUNDED: 'ORDER_STATUS_UPDATED',
    STOCK_RESERVED: 'ORDER_STATUS_UPDATED',
    STOCK_RELEASED: 'ORDER_STATUS_UPDATED',
    STOCK_ADJUSTED: 'ORDER_STATUS_UPDATED',
    INVENTORY_CONSUMED: 'ORDER_STATUS_UPDATED',
    INVENTORY_ALLOCATED: 'ORDER_STATUS_UPDATED',
    PROCUREMENT_ORDER_CREATED: 'RESTOCK_ORDER_CREATED',
    PROCUREMENT_SHIPPED: 'RESTOCK_ORDER_CREATED',
    PROCUREMENT_ARRIVED: 'RESTOCK_ORDER_CREATED',
    PROCUREMENT_INVENTORY_RECEIVED: 'RESTOCK_INVENTORY_RECEIVED',
  }

  const title = EVENT_TITLES[eventType]
  const message = formatNotificationMessage(
    EVENT_DESCRIPTIONS[eventType],
    {
      productName: metadata?.productName,
      orderId: order.id.slice(0, 8),
    }
  )

  try {
    await createNotification(
      order.userId,
      notificationTypeMap[eventType] as any,
      title,
      message
    )
  } catch (error) {
    console.error('Failed to create notification:', error)
  }
}

async function sendEventEmailIfNeeded(
  order: any,
  eventType: FulfillmentEventType,
  metadata?: EventMetadata
) {
  const emailTemplate = EMAIL_TEMPLATES[eventType]
  
  if (!emailTemplate || !order.customerEmail) {
    return
  }

  try {
    const customerName = order.user.profile?.firstName || 'Customer'
    const subject = emailTemplate.subject.replace('{productName}', metadata?.productName || '')
    const message = formatNotificationMessage(emailTemplate.message, {
      productName: metadata?.productName,
      orderId: order.id.slice(0, 8),
    })

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a2e;">Dhream Market</h1>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">The Smart Commerce Ecosystem</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px 24px;">
                    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">${subject}</h2>
                    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
                    <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">${message}</p>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">Thank you for shopping with Dhream Market!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                      This is an automated message from Dhream Market. Please do not reply to this email.
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
                      &copy; 2026 Dhream Market. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    await sendEmail({
      to: order.customerEmail,
      subject,
      htmlContent,
    })
  } catch (error) {
    console.error(`Failed to send email for event ${eventType}:`, error)
  }
}

export async function getFulfillmentEvents(orderId: string) {
  try {
    const events = await getPrisma().fulfillmentEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    })
    return events
  } catch (error) {
    console.error('Error fetching fulfillment events:', error)
    return []
  }
}

export async function getVendorDemandAlerts(vendorId: string) {
  try {
    const store = await getPrisma().store.findUnique({
      where: { userId: vendorId },
      include: { products: { select: { id: true } } },
    })

    if (!store) return { alerts: [] }

    const productIds = store.products?.map(p => p.id) || []

    const preorderCount = await getPrisma().order.count({
      where: {
        paymentStatus: 'PAID',
        orderType: 'PREORDER',
        items: { some: { productId: { in: productIds } } },
      },
    })

    const backorderCount = await getPrisma().order.count({
      where: {
        paymentStatus: 'PAID',
        orderType: 'BACKORDER',
        items: { some: { productId: { in: productIds } } },
      },
    })

    const totalDemand = preorderCount + backorderCount
    const alerts = []

    if (totalDemand >= 25) {
      alerts.push({ level: 'critical', message: 'Critical demand detected', threshold: 25 })
    } else if (totalDemand >= 10) {
      alerts.push({ level: 'high', message: 'Very high demand detected', threshold: 10 })
    } else if (totalDemand >= 5) {
      alerts.push({ level: 'medium', message: 'High demand detected', threshold: 5 })
    }

    return { alerts, preorderCount, backorderCount }
  } catch (error) {
    console.error('Error getting vendor demand alerts:', error)
    return { alerts: [] }
  }
}

export async function getAdminFulfillmentAlerts() {
  try {
    const [overduePreorders, overdueBackorders, backlogOrders] = await Promise.all([
      getPrisma().order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: 'PREORDER',
          fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK'] },
          OR: [
            { items: { some: { expectedArrivalDate: { lt: new Date() } } } },
          ],
        },
      }),
      getPrisma().order.count({
        where: {
          paymentStatus: 'PAID',
          orderType: 'BACKORDER',
          fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK'] },
          OR: [
            { items: { some: { expectedRestockDate: { lt: new Date() } } } },
          ],
        },
      }),
      getPrisma().order.count({
        where: {
          paymentStatus: 'PAID',
          fulfillmentStatus: { in: ['PENDING', 'AWAITING_STOCK', 'AWAITING_RESTOCK', 'READY_TO_FULFILL'] },
        },
      }),
    ])

    const alerts = []

    if (overduePreorders > 0) {
      alerts.push({ type: 'overdue_preorder', message: `${overduePreorders} overdue preorder(s) need attention`, count: overduePreorders })
    }

    if (overdueBackorders > 0) {
      alerts.push({ type: 'overdue_backorder', message: `${overdueBackorders} overdue backorder(s) need attention`, count: overdueBackorders })
    }

    if (backlogOrders > 50) {
      alerts.push({ type: 'large_backlog', message: `Large fulfillment backlog: ${backlogOrders} orders`, count: backlogOrders })
    }

    return { alerts }
  } catch (error) {
    console.error('Error getting admin fulfillment alerts:', error)
    return { alerts: [] }
  }
}