import { getPrisma } from './prisma'
import { verifyToken } from './auth-middleware'
import { NextRequest, NextResponse } from 'next/server'

export interface PlatformPreferences {
  maintenanceMode: boolean
  registrationOpen: boolean
  newVendorApproval: boolean
  autoApproveProducts: boolean
  defaultCurrency: string
  platformFee: number
  platformName: string
  platformTimezone: string
  brandingPreferences: BrandingPreferences
  auditLogRetention: string
  sessionTimeout: string
  allowedAdminIps: string[]
  monitoringPreferences: MonitoringPreferences
  platformBehaviourPreferences: PlatformBehaviourPreferences
}

export interface BrandingPreferences {
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  favicon?: string
  companyAddress?: string
  supportEmail?: string
  supportPhone?: string
  tagline?: string
  emailBackgroundColor?: string
  emailHeaderColor?: string
  emailHeaderTextColor?: string
  emailSubheaderColor?: string
  emailBorderColor?: string
  emailFooterBackgroundColor?: string
  statusColors?: Record<string, string>
  statusBackgrounds?: Record<string, string>
  primaryGradient?: string
  ogImage?: string
}

export interface MonitoringPreferences {
  alertsEnabled?: boolean
  emailAlerts?: boolean
  systemOutageAlerts?: boolean
  featureAnnouncementAlerts?: boolean
  policyUpdateAlerts?: boolean
  securityAlerts?: boolean
  infrastructureAlerts?: boolean
  financeAlerts?: boolean
}

export interface PlatformBehaviourPreferences {
  requireEmailVerification?: boolean
  autoApproveVendors?: boolean
  enableVendorMessaging?: boolean
  enableProductReviews?: boolean
  enableWishlist?: boolean
  enableComparisons?: boolean
  allowGuestCheckout?: boolean
  enableDigitalProducts?: boolean
  [key: string]: any
}

export interface NotificationPreferences {
  notifySystemOutage: boolean
  notifyFeatureAnnouncements: boolean
  notifyPolicyUpdates: boolean
  notifySecurityAlerts: boolean
  notifyInfrastructureAlerts: boolean
  notifyFinanceAlerts: boolean
}

export async function getPlatformPreferences(): Promise<PlatformPreferences> {
  let settings = await getPrisma().superAdminSettings.findFirst()
  if (!settings) {
    settings = await getPrisma().superAdminSettings.create({ data: {} })
  }
  return {
    maintenanceMode: settings.maintenanceMode ?? false,
    registrationOpen: settings.registrationOpen ?? true,
    newVendorApproval: settings.newVendorApproval ?? true,
    autoApproveProducts: settings.autoApproveProducts ?? false,
    defaultCurrency: settings.defaultCurrency ?? 'GHS',
    platformFee: settings.platformFee ?? 2.5,
    platformName: settings.platformName ?? 'Dhreamarket',
    platformTimezone: settings.platformTimezone ?? 'Africa/Accra',
    brandingPreferences: (settings.brandingPreferences as Record<string, any> ?? {}) as BrandingPreferences,
    auditLogRetention: settings.auditLogRetention ?? 'forever',
    sessionTimeout: settings.sessionTimeout ?? '8',
    allowedAdminIps: ((settings.allowedAdminIps as unknown[]) ?? []) as string[],
    monitoringPreferences: (settings.monitoringPreferences as Record<string, any> ?? {}) as MonitoringPreferences,
    platformBehaviourPreferences: (settings.platformBehaviourPreferences as Record<string, any> ?? {}) as PlatformBehaviourPreferences,
  }
}

export async function getPlatformFeeRate(): Promise<number> {
  const preferences = await getPlatformPreferences()
  return preferences.platformFee / 100
}

export async function getMaintenanceMode(): Promise<boolean> {
  const preferences = await getPlatformPreferences()
  return preferences.maintenanceMode
}

export async function isRegistrationOpen(): Promise<boolean> {
  const preferences = await getPlatformPreferences()
  return preferences.registrationOpen
}

export async function isNewVendorApprovalRequired(): Promise<boolean> {
  const preferences = await getPlatformPreferences()
  return preferences.newVendorApproval
}

export async function isAutoApproveProducts(): Promise<boolean> {
  const preferences = await getPlatformPreferences()
  return preferences.autoApproveProducts
}

export async function getPlatformName(): Promise<string> {
  const preferences = await getPlatformPreferences()
  return preferences.platformName || 'Dhreamarket'
}

export async function getPlatformTimezone(): Promise<string> {
  const preferences = await getPlatformPreferences()
  return preferences.platformTimezone || 'Africa/Accra'
}

export async function getDefaultCurrency(): Promise<string> {
  const preferences = await getPlatformPreferences()
  return preferences.defaultCurrency || 'GHS'
}

export async function getBrandingPreferences(): Promise<BrandingPreferences> {
  const preferences = await getPlatformPreferences()
  return preferences.brandingPreferences ?? {}
}

export async function getSessionTimeoutMs(): Promise<number> {
  const preferences = await getPlatformPreferences()
  const hours = parseInt(preferences.sessionTimeout, 10)
  if (isNaN(hours) || hours <= 0) return 8 * 60 * 60 * 1000
  return hours * 60 * 60 * 1000
}

export async function getAuditLogRetention(): Promise<string> {
  const preferences = await getPlatformPreferences()
  return preferences.auditLogRetention || 'forever'
}

export async function getAllowedAdminIps(): Promise<string[]> {
  const preferences = await getPlatformPreferences()
  return (preferences.allowedAdminIps ?? []) as string[]
}

export async function getMonitoringPreferences(): Promise<MonitoringPreferences> {
  const preferences = await getPlatformPreferences()
  return preferences.monitoringPreferences ?? {}
}

export async function getPlatformBehaviourPreferences(): Promise<PlatformBehaviourPreferences> {
  const preferences = await getPlatformPreferences()
  return preferences.platformBehaviourPreferences ?? {}
}

export async function isEmailVerificationRequired(): Promise<boolean> {
  const prefs = await getPlatformBehaviourPreferences()
  if (!('requireEmailVerification' in prefs)) {
    return isEmailServiceEnabled()
  }
  return prefs.requireEmailVerification ?? false
}

export async function isAutoApproveVendors(): Promise<boolean> {
  const prefs = await getPlatformBehaviourPreferences()
  return prefs.autoApproveVendors ?? false
}

export async function isGuestCheckoutAllowed(): Promise<boolean> {
  const prefs = await getPlatformBehaviourPreferences()
  return prefs.allowGuestCheckout ?? false
}

export async function areProductReviewsEnabled(): Promise<boolean> {
  const prefs = await getPlatformBehaviourPreferences()
  return prefs.enableProductReviews ?? true
}

export async function isWishlistEnabled(): Promise<boolean> {
  const prefs = await getPlatformBehaviourPreferences()
  return prefs.enableWishlist ?? true
}

export async function isComparisonsEnabled(): Promise<boolean> {
  const prefs = await getPlatformBehaviourPreferences()
  return prefs.enableComparisons ?? true
}

export async function areDigitalProductsEnabled(): Promise<boolean> {
  const prefs = await getPlatformBehaviourPreferences()
  return prefs.enableDigitalProducts ?? true
}

export async function isVendorMessagingEnabled(): Promise<boolean> {
  const prefs = await getPlatformBehaviourPreferences()
  return prefs.enableVendorMessaging ?? true
}

export function formatDateForPlatform(date: Date | string, timezone?: string): string {
  const tz = timezone || 'Africa/Accra'
  return new Intl.DateTimeFormat('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(new Date(date))
}

export function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    GHS: '₵',
    USD: '$',
    EUR: '€',
    GBP: '£',
    NGN: '₦',
    KES: 'KSh',
    ZAR: 'R',
    CAD: 'C$',
    AUD: 'A$',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
  }
  return symbols[currencyCode] || '$'
}

export async function formatCurrencyForPlatform(amount: number, currency?: string): Promise<string> {
  const prefCurrency = currency || await getDefaultCurrency()
  const localeMap: Record<string, string> = {
    GHS: 'en-GH',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    NGN: 'en-NG',
    KES: 'en-KE',
    ZAR: 'en-ZA',
    CAD: 'en-CA',
    AUD: 'en-AU',
    JPY: 'ja-JP',
    CNY: 'zh-CN',
    INR: 'en-IN',
  }
  const locale = localeMap[prefCurrency] || 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: prefCurrency,
  }).format(amount)
}

export async function formatPriceForPlatform(amount: number): Promise<string> {
  return formatCurrencyForPlatform(amount)
}

export async function checkMaintenanceApi(request: NextRequest): Promise<NextResponse | null> {
  const preferences = await getPlatformPreferences()
  if (!preferences.maintenanceMode) {
    return null
  }

  const token = request.cookies.get('token')?.value
  let isSuperAdmin = false
  if (token) {
    const payload = await verifyToken(token)
    isSuperAdmin = payload?.role === 'SUPER_ADMIN'
  }

  if (!isSuperAdmin) {
    return NextResponse.json(
      { error: 'Platform is under maintenance. Please try again later.', maintenanceMode: true },
      { status: 503 }
    )
  }
  return null
}

export async function areMonitoringAlertsEnabled(): Promise<boolean> {
  const prefs = await getMonitoringPreferences()
  return prefs.alertsEnabled ?? true
}

export async function isEmailAlertEnabled(): Promise<boolean> {
  const prefs = await getMonitoringPreferences()
  return prefs.emailAlerts ?? true
}

export async function isSystemOutageAlertEnabled(): Promise<boolean> {
  const prefs = await getMonitoringPreferences()
  return prefs.systemOutageAlerts ?? true
}

export async function isFeatureAnnouncementAlertEnabled(): Promise<boolean> {
  const prefs = await getMonitoringPreferences()
  return prefs.featureAnnouncementAlerts ?? true
}

export async function isPolicyUpdateAlertEnabled(): Promise<boolean> {
  const prefs = await getMonitoringPreferences()
  return prefs.policyUpdateAlerts ?? true
}

export async function isSecurityAlertEnabled(): Promise<boolean> {
  const prefs = await getMonitoringPreferences()
  return prefs.securityAlerts ?? true
}

export async function isInfrastructureAlertEnabled(): Promise<boolean> {
  const prefs = await getMonitoringPreferences()
  return prefs.infrastructureAlerts ?? true
}

export async function isFinanceAlertEnabled(): Promise<boolean> {
  const prefs = await getMonitoringPreferences()
  return prefs.financeAlerts ?? true
}

export async function shouldSendMonitoringAlert(alertType: string): Promise<boolean> {
  const prefs = await getMonitoringPreferences()
  if (prefs.alertsEnabled === false) return false

  const alertTypeMap: Record<string, () => boolean | undefined> = {
    SYSTEM_OUTAGE: () => prefs.systemOutageAlerts,
    EMAIL: () => prefs.emailAlerts,
    FEATURE_ANNOUNCEMENT: () => prefs.featureAnnouncementAlerts,
    POLICY_UPDATE: () => prefs.policyUpdateAlerts,
    SECURITY: () => prefs.securityAlerts,
    INFRASTRUCTURE: () => prefs.infrastructureAlerts,
    FINANCE: () => prefs.financeAlerts,
  }

  const check = alertTypeMap[alertType]
  if (check) {
    const result = check()
    if (result !== undefined) return result
  }

  return true
}
