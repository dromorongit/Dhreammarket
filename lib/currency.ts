import { formatCurrencyForPlatform, formatPriceForPlatform } from './platform-preferences'

declare global {
  interface Window {
    __PLATFORM_CURRENCY__?: string
  }
}

export type Currency = string

/**
 * Formats a number as currency using the platform's default currency from SuperAdminSettings.
 * Falls back to GHS if no platform setting is available.
 * @param amount - The numeric amount to format
 * @param currency - Optional currency code (defaults to platform default currency)
 * @returns Formatted currency string
 */
export async function formatCurrency(amount: number, currency?: string): Promise<string> {
  if (currency) {
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
    const locale = localeMap[currency] || 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }
  return formatCurrencyForPlatform(amount)
}

/**
 * Formats a number as currency using the platform's default currency from SuperAdminSettings.
 * Alias for formatCurrency with platform default currency.
 * @param amount - The numeric amount to format
 * @returns Formatted currency string in platform default currency
 */
export async function formatPrice(amount: number): Promise<string> {
  return formatPriceForPlatform(amount)
}