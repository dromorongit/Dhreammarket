// Centralized revenue calculation logic for Dhream Market
import { formatCurrency } from './currency'
import { getPrisma } from './prisma'

const MAX_VENDOR_COMMISSION_RATES = 1000

/**
 * Configuration for commission rates
 * In a real application, this might come from a database or environment variables
 */
export const COMMISSION_CONFIG = {
  DEFAULT_RATE: 0.01,
  FALLBACK_PROCESSOR_FEE_RATE: 0.02,
}

let cachedPlatformFeePercent: number | null = null
let cachedPlatformFeeAt = 0
const PLATFORM_FEE_CACHE_TTL_MS = 60_000

async function getPlatformFeePercent(): Promise<number> {
  const now = Date.now()
  if (cachedPlatformFeePercent !== null && now - cachedPlatformFeeAt < PLATFORM_FEE_CACHE_TTL_MS) {
    return cachedPlatformFeePercent
  }

  try {
    const settings = await getPrisma().superAdminSettings.findFirst()
    const raw = settings?.platformFee ?? COMMISSION_CONFIG.DEFAULT_RATE * 100
    cachedPlatformFeePercent = typeof raw === 'number' ? raw : parseFloat(String(raw))
  } catch {
    cachedPlatformFeePercent = COMMISSION_CONFIG.DEFAULT_RATE * 100
  }

  cachedPlatformFeeAt = now
  return cachedPlatformFeePercent
}

export async function getCommissionRate(): Promise<number> {
  const percent = await getPlatformFeePercent()
  return percent / 100
}

export function invalidatePlatformFeeCache(): void {
  cachedPlatformFeePercent = null
  cachedPlatformFeeAt = 0
}

/**
 * Vendor commission rate cache
 * Bounded to prevent unbounded memory growth.
 */
const vendorCommissionRates: Map<string, number> = new Map()

function enforceVendorCommissionRateCap(): void {
  if (vendorCommissionRates.size <= MAX_VENDOR_COMMISSION_RATES) return

  const keys = Array.from(vendorCommissionRates.keys())
  const excess = vendorCommissionRates.size - MAX_VENDOR_COMMISSION_RATES
  for (let i = 0; i < excess && i < keys.length; i++) {
    vendorCommissionRates.delete(keys[i])
  }
}

export function getVendorCommissionRate(vendorId: string | null | undefined): number {
  if (!vendorId) return COMMISSION_CONFIG.DEFAULT_RATE
  return vendorCommissionRates.get(vendorId) ?? COMMISSION_CONFIG.DEFAULT_RATE
}

export function setVendorCommissionRate(vendorId: string, rate: number): void {
  enforceVendorCommissionRateCap()
  vendorCommissionRates.set(vendorId, rate)
}

export function clearVendorCommissionRates(): void {
  vendorCommissionRates.clear()
}

export async function calculateFinancialBreakdown(
  grossAmount: number,
  processorFee: number | null = null,
  commissionRate: number | null = null
) {
  const rate = commissionRate ?? await getCommissionRate()
  const netAmount = processorFee !== null ? grossAmount - processorFee : null
  const platformCommission = grossAmount * rate
  const vendorEarnings = netAmount !== null ? netAmount - platformCommission : null

  return {
    grossAmount,
    processorFee,
    netAmount,
    platformCommission,
    vendorEarnings,
    commissionRate: rate,
  }
}

export type FinancialBreakdown = {
  grossAmount: number
  processorFee: number | null
  netAmount: number | null
  platformCommission: number
  vendorEarnings: number | null
  commissionRate: number
}

export function formatFinancialBreakdown(financialBreakdown: FinancialBreakdown) {
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

export function resolveProcessorFee(
  paystackFees: number | null | undefined,
  grossAmount: number
): number {
  if (paystackFees !== null && paystackFees !== undefined && paystackFees > 0) {
    return paystackFees
  }
  return grossAmount * COMMISSION_CONFIG.FALLBACK_PROCESSOR_FEE_RATE
}
