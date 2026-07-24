// Centralized revenue calculation logic for Dhream Market
import { formatCurrency } from './currency'
import { getPlatformFeeRate } from './platform-preferences'

/**
 * Configuration for non-commission rates
 */
export const COMMISSION_CONFIG = {
  FALLBACK_PROCESSOR_FEE_RATE: 0.02,
}

/**
 * Vendor commission rate cache
 * In production, this would be stored in the database
 */
const vendorCommissionRates: Map<string, number> = new Map()

/**
 * Get the commission rate for a vendor
 * @param vendorId - The vendor's user ID
 * @returns The commission rate to use (reads from SuperAdminSettings when no vendor-specific rate is cached)
 */
export async function getVendorCommissionRate(vendorId: string | null | undefined): Promise<number> {
  if (!vendorId) {
    return getPlatformFeeRate()
  }
  const cached = vendorCommissionRates.get(vendorId)
  if (cached !== undefined) {
    return cached
  }
  return getPlatformFeeRate()
}

/**
 * Set a custom commission rate for a vendor
 * @param vendorId - The vendor's user ID
 * @param rate - The commission rate (e.g., 0.01 for 1%)
 */
export function setVendorCommissionRate(vendorId: string, rate: number): void {
  vendorCommissionRates.set(vendorId, rate)
}

/**
 * Clear all cached vendor commission rates
 */
export function clearVendorCommissionRates(): void {
  vendorCommissionRates.clear()
}

/**
 * Calculate financial breakdown for an order or order item
 * @param grossAmount - The total amount before any fees
 * @param processorFee - The payment processor fee (if known, otherwise null)
 * @param commissionRate - The commission rate to apply (must be provided, reads from SuperAdminSettings)
 * @returns Object containing all financial calculations
 */
export function calculateFinancialBreakdown(
  grossAmount: number,
  processorFee: number | null = null,
  commissionRate: number
) {
  // Calculate net amount (gross - processor fee) if fee is known
  const netAmount = processorFee !== null ? grossAmount - processorFee : null
  
  // Calculate platform commission
  const platformCommission = grossAmount * commissionRate
  
  // Calculate vendor earnings (net amount - platform commission) if net amount is known
  const vendorEarnings = netAmount !== null ? netAmount - platformCommission : null
  
  return {
    grossAmount,
    processorFee,
    netAmount,
    platformCommission,
    vendorEarnings,
    commissionRate
  }
}

/**
 * Format financial values as currency strings using GHS
 * @param financialBreakdown - The financial breakdown object from calculateFinancialBreakdown
 * @returns Object with formatted currency strings
 */
export function formatFinancialBreakdown(financialBreakdown: ReturnType<typeof calculateFinancialBreakdown>) {
  return {
    grossAmount: formatCurrency(financialBreakdown.grossAmount),
    processorFee: financialBreakdown.processorFee !== null 
      ? formatCurrency(financialBreakdown.processorFee) 
      : null,
    netAmount: financialBreakdown.netAmount !== null 
      ? formatCurrency(financialBreakdown.netAmount) 
      : null,
    platformCommission: formatCurrency(financialBreakdown.platformCommission),
    vendorEarnings: financialBreakdown.vendorEarnings !== null 
      ? formatCurrency(financialBreakdown.vendorEarnings) 
      : null,
    commissionRate: `${(financialBreakdown.commissionRate * 100).toFixed(2)}%`
  }
}

/**
 * Calculate apportioned processor fee for an order item based on its contribution to gross amount
 * @param itemGross - The gross amount for this order item
 * @param orderGross - The total gross amount for the order
 * @param totalProcessorFee - The total processor fee for the order
 * @returns The apportioned processor fee for this item, or null if total fee is unknown
 */
export function apportionProcessorFee(
  itemGross: number,
  orderGross: number,
  totalProcessorFee: number | null
): number | null {
  if (totalProcessorFee === null || orderGross === 0) {
    return null
  }
  return (itemGross / orderGross) * totalProcessorFee
}

/**
 * Resolve the actual processor fee from Paystack, falling back to an estimated rate when missing.
 * @param paystackFees - The actual fee from Paystack transaction data (data.fees)
 * @param grossAmount - The gross amount of the order
 * @returns The resolved processor fee (actual or estimated)
 */
export function resolveProcessorFee(
  paystackFees: number | null | undefined,
  grossAmount: number
): number {
  if (paystackFees !== null && paystackFees !== undefined && paystackFees > 0) {
    return paystackFees
  }
  return grossAmount * COMMISSION_CONFIG.FALLBACK_PROCESSOR_FEE_RATE
}
