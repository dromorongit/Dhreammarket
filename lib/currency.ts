// Currency configuration for Dhream Market
export const DEFAULT_CURRENCY = 'GHS'
export const CURRENCY_SYMBOLS = {
  GHS: 'GH₵',
  USD: '$',
  // Add more currencies as needed
} as const

export type Currency = keyof typeof CURRENCY_SYMBOLS

/**
 * Formats a number as currency for the default platform currency (GHS)
 * @param amount - The numeric amount to format
 * @param currency - Optional currency code (defaults to GHS)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: Currency = DEFAULT_CURRENCY): string {
  const symbol = CURRENCY_SYMBOLS[currency] || CURRENCY_SYMBOLS[DEFAULT_CURRENCY]

  // Use Intl.NumberFormat for proper formatting
  const formatted = new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return `${symbol} ${formatted}`
}

/**
 * Formats a number as currency for display (alias for formatCurrency with default currency)
 * @param amount - The numeric amount to format
 * @returns Formatted currency string in default currency
 */
export function formatPrice(amount: number): string {
  return formatCurrency(amount)
}