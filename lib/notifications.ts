import { getPrisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'
import { shouldSendNotification } from './notification-preferences'

export interface NotificationEvent {
  id: string
  userId: string
  type: NotificationType | string
  title: string
  message: string
  metadata?: Record<string, any> | null
  status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED'
  channel?: 'EMAIL' | 'SMS' | 'IN_APP'
  scheduledFor?: string | null
  sentAt?: string | null
  createdAt: string
}

export interface NotificationTemplate {
  type: string
  title: string
  messageTemplate: string
  channels: ('EMAIL' | 'SMS' | 'IN_APP')[]
}

export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  PREORDER_PLACED: {
    type: 'ORDER_PLACED',
    title: 'Pre-order Confirmed',
    messageTemplate: 'Your pre-order for {productName} has been confirmed. Expected arrival: {expectedDate}',
    channels: ['EMAIL', 'IN_APP'],
  },
  BACKORDER_PLACED: {
    type: 'ORDER_PLACED',
    title: 'Backorder Request Received',
    messageTemplate: 'Your backorder request for {productName} has been received. Expected restock: {expectedDate}',
    channels: ['EMAIL', 'IN_APP'],
  },
  FULFILLMENT_STATUS_UPDATED: {
    type: 'ORDER_STATUS_UPDATED',
    title: 'Order Fulfillment Update',
    messageTemplate: 'Your order fulfillment status has been updated to: {status}',
    channels: ['EMAIL', 'SMS', 'IN_APP'],
  },
  PREORDER_ARRIVED: {
    type: 'ORDER_STATUS_UPDATED',
    title: 'Pre-order Item Arrived',
    messageTemplate: 'Great news! Your pre-ordered item {productName} is now in stock and will be processed soon.',
    channels: ['EMAIL', 'IN_APP'],
  },
  BACKORDER_RESTOCKED: {
    type: 'ORDER_STATUS_UPDATED',
    title: 'Backorder Item Restocked',
    messageTemplate: 'Great news! Your backordered item {productName} is now available.',
    channels: ['EMAIL', 'IN_APP'],
  },
  OVERDUE_FULFILLMENT: {
    type: 'ORDER_STATUS_UPDATED',
    title: 'Order Fulfillment Delayed',
    messageTemplate: 'Your order for {productName} is experiencing delays. We apologize for the inconvenience.',
    channels: ['EMAIL', 'IN_APP'],
  },
  SERVICE_REQUEST_CREATED: {
    type: 'SERVICE_REQUEST_CREATED',
    title: 'Service Request Created',
    messageTemplate: 'A new service request "{requestTitle}" has been submitted.',
    channels: ['EMAIL', 'IN_APP'],
  },
  QUOTE_SENT: {
    type: 'QUOTE_SENT',
    title: 'Quotation Sent',
    messageTemplate: 'A quotation has been sent for service request "{requestTitle}".',
    channels: ['EMAIL', 'IN_APP'],
  },
  QUOTE_ACCEPTED: {
    type: 'QUOTE_ACCEPTED',
    title: 'Quotation Accepted',
    messageTemplate: 'Your quotation for service request "{requestTitle}" has been accepted.',
    channels: ['EMAIL', 'IN_APP'],
  },
  QUOTE_REJECTED: {
    type: 'QUOTE_REJECTED',
    title: 'Quotation Rejected',
    messageTemplate: 'Your quotation for service request "{requestTitle}" has been rejected.',
    channels: ['EMAIL', 'IN_APP'],
  },
  PROJECT_STARTED: {
    type: 'PROJECT_STARTED',
    title: 'Project Started',
    messageTemplate: 'The project for service request "{requestTitle}" has been started.',
    channels: ['EMAIL', 'IN_APP'],
  },
  PROJECT_COMPLETED: {
    type: 'PROJECT_COMPLETED',
    title: 'Project Completed',
    messageTemplate: 'The project for service request "{requestTitle}" has been completed.',
    channels: ['EMAIL', 'IN_APP'],
  },
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string
): Promise<void> {
  if (!(await shouldSendNotification(userId, type))) {
    return
  }
  try {
    await getPrisma().notification.create({
      data: {
        userId,
        type,
        title,
        message,
      },
    })
  } catch (error) {
    console.error('Error creating notification:', error)
  }
}

export async function createNotificationEvent(
  data: Omit<NotificationEvent, 'id' | 'createdAt'>
): Promise<any | null> {
  if (!(await shouldSendNotification(data.userId, data.type as NotificationType))) {
    return null
  }
  try {
    const notification = await getPrisma().notification.create({
      data: {
        userId: data.userId,
        type: data.type as NotificationType,
        title: data.title,
        message: data.message,
      },
    })
    return notification
  } catch (error) {
    console.error('Error creating notification event:', error)
    return null
  }
}

export async function getPendingNotifications() {
  try {
    const notifications = await getPrisma().notification.findMany({
      where: {
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    return notifications
  } catch (error) {
    console.error('Error fetching pending notifications:', error)
    return []
  }
}

export function formatNotificationMessage(
  template: string,
  variables: Record<string, string | number | null | undefined>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key]
    if (value === null || value === undefined) return ''
    if (value && typeof value === 'object' && 'getTime' in value) return new Date(value as any).toLocaleDateString()
    return String(value)
  })
}

export function getDaysUntilDate(date: Date | string | null): number | null {
  if (!date) return null
  const target = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}