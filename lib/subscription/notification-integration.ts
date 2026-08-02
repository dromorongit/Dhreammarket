import { createNotification } from '@/lib/notifications'
import { NotificationType } from '@prisma/client'
import { logInfo, logError } from '@/lib/logger'

export async function sendSubscriptionNotification(
  vendorId: string,
  event: 'SUBSCRIPTION_ACTIVATED' | 'SUBSCRIPTION_EXPIRING' | 'SUBSCRIPTION_RENEWED' | 'SUBSCRIPTION_CANCELLED' | 'INVOICE_GENERATED' | 'PAYMENT_SUCCESSFUL' | 'PAYMENT_FAILED',
  data: {
    planName?: string
    amount?: number
    invoiceNumber?: string
    nextRenewalAt?: string
    message?: string
  }
): Promise<void> {
  const templates: Record<string, { title: string; messageTemplate: string }> = {
    SUBSCRIPTION_ACTIVATED: {
      title: 'Subscription Activated',
      messageTemplate: `Your ${data.planName ?? 'subscription'} has been activated. Welcome to the platform!`,
    },
    SUBSCRIPTION_EXPIRING: {
      title: 'Subscription Expiring Soon',
      messageTemplate: `Your ${data.planName ?? 'subscription'} will expire on ${data.nextRenewalAt ?? 'soon'}. Renew to continue enjoying benefits.`,
    },
    SUBSCRIPTION_RENEWED: {
      title: 'Subscription Renewed',
      messageTemplate: `Your ${data.planName ?? 'subscription'} has been renewed successfully.`,
    },
    SUBSCRIPTION_CANCELLED: {
      title: 'Subscription Cancelled',
      messageTemplate: data.message ?? 'Your subscription has been cancelled.',
    },
    INVOICE_GENERATED: {
      title: 'Invoice Generated',
      messageTemplate: `Invoice ${data.invoiceNumber ?? 'N/A'} for ${data.amount ?? 0} GHS has been generated.`,
    },
    PAYMENT_SUCCESSFUL: {
      title: 'Payment Successful',
      messageTemplate: `Payment of ${data.amount ?? 0} GHS received. Your subscription is now active.`,
    },
    PAYMENT_FAILED: {
      title: 'Payment Failed',
      messageTemplate: data.message ?? 'Your payment could not be processed. Please try again.',
    },
  }

  const template = templates[event]
  if (!template) return

  try {
    await createNotification(
      vendorId,
      event as NotificationType,
      template.title,
      template.messageTemplate
    )
    logInfo(`Subscription notification sent: vendor=${vendorId}, event=${event}`)
  } catch (error) {
    logError('Error sending subscription notification:', error)
  }
}

export async function sendSubscriptionExpiringNotifications() {
  const prisma = getPrisma()
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const expiringSubscriptions = await prisma.vendorSubscription.findMany({
    where: {
      status: 'ACTIVE',
      nextRenewalAt: { lte: sevenDaysFromNow, gte: now },
    },
    include: { vendor: { select: { id: true, email: true } }, plan: { select: { name: true } } },
  })

  for (const sub of expiringSubscriptions) {
    await sendSubscriptionNotification(sub.vendorId, 'SUBSCRIPTION_EXPIRING', {
      planName: sub.plan?.name,
      nextRenewalAt: sub.nextRenewalAt?.toISOString(),
    })
  }

  return expiringSubscriptions.length
}

export async function sendPaymentSuccessNotification(vendorId: string, amount: number, planName: string) {
  await sendSubscriptionNotification(vendorId, 'PAYMENT_SUCCESSFUL', {
    planName,
    amount,
  })
}

export async function sendPaymentFailedNotification(vendorId: string, amount: number, reason: string) {
  await sendSubscriptionNotification(vendorId, 'PAYMENT_FAILED', {
    amount,
    message: reason,
  })
}