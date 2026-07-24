import { getPrisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'

export async function getCustomerNotificationPreferences(userId: string) {
  return getPrisma().profile.findUnique({
    where: { userId },
    select: {
      emailNotifications: true,
      orderNotifications: true,
      promotionalNotifications: true,
      systemNotifications: true,
    },
  })
}

export async function getVendorNotificationPreferences(userId: string) {
  return getPrisma().vendorSettings.findUnique({
    where: { userId },
    select: {
      notifyNewOrders: true,
      notifyLowStock: true,
      notifyCustomerMessages: true,
      notifySettlements: true,
    },
  })
}

export async function getAdminNotificationPreferences(userId: string) {
  return getPrisma().adminSettings.findUnique({
    where: { userId },
    select: {
      notifyNewUsers: true,
      notifyVerificationRequests: true,
      notifySupportTickets: true,
      notifyOrderAnomalies: true,
      notifySecurityAlerts: true,
    },
  })
}

export async function getSuperAdminNotificationPreferences() {
  return getPrisma().superAdminSettings.findFirst({
    select: {
      notifySystemOutage: true,
      notifyFeatureAnnouncements: true,
      notifyPolicyUpdates: true,
      notifySecurityAlerts: true,
      notifyInfrastructureAlerts: true,
      notifyFinanceAlerts: true,
    },
  })
}

function shouldNotifyCustomer(
  prefs: { emailNotifications: boolean; orderNotifications: boolean; promotionalNotifications: boolean; systemNotifications: boolean } | null,
  type: NotificationType
): boolean {
  if (!prefs) return true
  switch (type) {
    case 'ORDER_PLACED':
    case 'PAYMENT_SUCCESSFUL':
    case 'ORDER_STATUS_UPDATED':
    case 'ORDER_CANCELLED':
      return prefs.orderNotifications
    case 'SUPPORT_TICKET_CREATED':
    case 'SUPPORT_TICKET_REPLIED':
    case 'SUPPORT_TICKET_STATUS_UPDATED':
    case 'REVIEW_SUBMITTED':
    case 'REVIEW_RECEIVED':
      return prefs.systemNotifications
    default:
      return prefs.systemNotifications
  }
}

function shouldNotifyVendor(
  prefs: { notifyNewOrders: boolean; notifyLowStock: boolean; notifyCustomerMessages: boolean; notifySettlements: boolean } | null,
  type: NotificationType
): boolean {
  if (!prefs) return true
  switch (type) {
    case 'ORDER_PLACED':
    case 'ORDER_STATUS_UPDATED':
    case 'RESTOCK_ORDER_CREATED':
    case 'RESTOCK_INVENTORY_RECEIVED':
      return prefs.notifyNewOrders
    case 'RESTOCK_ORDER_OVERDUE':
      return prefs.notifyLowStock
    case 'SUPPORT_TICKET_CREATED':
      return prefs.notifyCustomerMessages
    default:
      return prefs.notifyNewOrders
  }
}

function shouldNotifyAdmin(
  prefs: { notifyNewUsers: boolean; notifyVerificationRequests: boolean; notifySupportTickets: boolean; notifyOrderAnomalies: boolean; notifySecurityAlerts: boolean } | null,
  type: NotificationType
): boolean {
  if (!prefs) return true
  switch (type) {
    case 'SUPPORT_TICKET_CREATED':
      return prefs.notifySupportTickets
    default:
      return true
  }
}

function shouldNotifySuperAdmin(
  prefs: { notifySystemOutage: boolean; notifyFeatureAnnouncements: boolean; notifyPolicyUpdates: boolean; notifySecurityAlerts: boolean; notifyInfrastructureAlerts: boolean; notifyFinanceAlerts: boolean } | null,
  type: NotificationType
): boolean {
  if (!prefs) return true
  return true
}

export async function shouldSendNotification(userId: string, type: NotificationType): Promise<boolean> {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user) return false

  switch (user.role) {
    case 'CUSTOMER': {
      const prefs = await getCustomerNotificationPreferences(userId)
      return shouldNotifyCustomer(prefs, type)
    }
    case 'VENDOR': {
      const prefs = await getVendorNotificationPreferences(userId)
      return shouldNotifyVendor(prefs, type)
    }
    case 'ADMIN': {
      const prefs = await getAdminNotificationPreferences(userId)
      return shouldNotifyAdmin(prefs, type)
    }
    case 'SUPER_ADMIN': {
      const prefs = await getAdminNotificationPreferences(userId)
      if (!shouldNotifyAdmin(prefs, type)) return false
      const superPrefs = await getSuperAdminNotificationPreferences()
      return shouldNotifySuperAdmin(superPrefs, type)
    }
    default:
      return true
  }
}

export async function canSendCustomerEmail(userId: string): Promise<boolean> {
  const prefs = await getCustomerNotificationPreferences(userId)
  return prefs?.emailNotifications ?? true
}
